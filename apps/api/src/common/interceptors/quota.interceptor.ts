import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { TokenAccountant } from '@studyai/domain';
import { TOKEN_COST_KEY } from '../decorators/token-cost.decorator';

/**
 * QuotaInterceptor — ADR-007 (Pure Redis Mutex Consensus)
 *
 * Responsibilities (HTTP layer only):
 *  1. Read the token cost from route metadata (@TokenCost decorator).
 *  2. Read the authenticated user ID from the request.
 *  3. Generate a unique reqId (UUIDv4) for this HTTP request.
 *  4. Delegate reservation to TokenAccountant (domain service).
 *  5. On success:    commit(reqId)  — removes pending entry, keeps counter.
 *  6. On failure:    release(reqId) — removes pending entry, decrements counter.
 *  7. On disconnect: release(reqId) — same as failure path.
 *
 * This interceptor contains ZERO business logic.
 * All quota rules (amounts, tier limits, Lua scripts) live in packages/domain.
 *
 * Failure Path Guarantee (ADR-007):
 *  - Controller throws     → catchError  → release(reqId) → rethrow
 *  - Client disconnects    → finalize    → release(reqId)
 *  - Stream interrupted    → finalize    → release(reqId)
 *  - Normal completion     → tap.complete → commit(reqId)
 *  - No @TokenCost route   → pass-through with no reservation
 *  - Unauthenticated user  → pass-through (JwtAuthGuard handles 401 before we run)
 *
 * Race safety (ADR-007):
 *  RELEASE_LUA uses HDEL as a one-shot mutex. If the Leak Reconciliation Worker
 *  already swept and refunded this reqId, release() returns false (no double-refund).
 *  If the Worker swept before commit() fires, commit() returns false (free generation,
 *  acceptable per ADR-006 business decision).
 */
@Injectable()
export class QuotaInterceptor implements NestInterceptor {
  /**
   * Default daily token quota per user (when no tier-specific limit is set).
   * This is the infrastructure-level hard cap. Tier-specific limits are
   * enforced by the TokenAccountant via the domain policy.
   *
   * TODO (Milestone 2 — Architecture E): Replace with per-tier quota
   * fetched from UserQuota table via ISecurityRepository.
   */
  private static readonly DEFAULT_DAILY_QUOTA = 100_000;

  constructor(
    private readonly reflector: Reflector,
    @Inject('TokenAccountant') private readonly tokenAccountant: TokenAccountant,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const tokenCost = this.reflector.getAllAndOverride<number | undefined>(
      TOKEN_COST_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If the route has no @TokenCost decoration, pass through immediately.
    if (!tokenCost || tokenCost <= 0) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request?.user?.id ?? request?.user?.sub;

    // If the user is not authenticated, pass through.
    // JwtAuthGuard (which runs before this interceptor) is responsible for 401.
    if (!userId) {
      return next.handle();
    }

    // Unique identifier for this single HTTP request's reservation lifecycle.
    const reqId = randomUUID();

    // Lifecycle latches — prevent duplicate commit/release calls across
    // tap.complete / catchError / finalize execution paths.
    let reserved = false;
    let resolved = false;

    return new Observable((subscriber) => {
      let isUnsubscribed = false;

      // Phase 1: Reserve tokens atomically via Lua script.
      this.tokenAccountant
        .reserve(userId, reqId, QuotaInterceptor.DEFAULT_DAILY_QUOTA, tokenCost)
        .then((success: boolean) => {
          if (!success) {
            // Quota exceeded — fail closed with 402 Payment Required.
            subscriber.error(
              new HttpException(
                'Daily token quota exceeded. Please upgrade your plan.',
                HttpStatus.PAYMENT_REQUIRED,
              ),
            );
            return;
          }

          // If the client disconnected during the Redis reservation wait,
          // the stream is dead. Refund the tokens immediately and abort.
          if (isUnsubscribed) {
            this.tokenAccountant.release(reqId).catch(() => {});
            return;
          }

          reserved = true;

          // Phase 2: Hand off to the controller and wrap with lifecycle hooks.
          const subscription = next
            .handle()
            .pipe(
              tap({
                complete: () => {
                  // Normal completion — commit the reservation.
                  // resolved latch prevents release() firing in finalize() afterwards.
                  if (reserved && !resolved) {
                    resolved = true;
                    this.tokenAccountant.commit(reqId).catch(() => {
                      // Non-fatal: if commit network call fails, the pending entry
                      // remains. The Leak Reconciliation Worker (Step 5 cron) will
                      // sweep it after the stale timeout and issue a refund.
                      // This is an acceptable free generation per ADR-006.
                    });
                  }
                },
              }),
              catchError((err) => {
                // Controller or application service threw.
                // Release all reserved tokens before re-throwing.
                if (reserved && !resolved) {
                  resolved = true;
                  this.tokenAccountant.release(reqId).catch(() => {
                    // Non-fatal: if release fails, the Step 5 sync worker
                    // will reconcile Redis on the next sweep cycle.
                  });
                }
                return throwError(() => err);
              }),
              finalize(() => {
                // Fires on: normal completion, error, or client disconnect.
                // If resolved is already true (tap.complete or catchError ran), skip.
                if (reserved && !resolved) {
                  resolved = true;
                  // We reach here only on client disconnect / stream interruption
                  // because tap.complete and catchError both set resolved = true first.
                  this.tokenAccountant.release(reqId).catch(() => {});
                }
              }),
            )
            .subscribe(subscriber);

          // Crucial: chain the inner subscription to the outer subscriber.
          // This ensures that if NestJS unsubscribes the outer observable,
          // the unsubscription signal propagates down, triggering `finalize`.
          subscriber.add(subscription);
        })
        .catch((_err: unknown) => {
          // Redis unavailable or Lua script failed.
          // Fail closed: deny the request with 503.
          subscriber.error(
            new HttpException(
              'Quota service temporarily unavailable. Please retry.',
              HttpStatus.SERVICE_UNAVAILABLE,
            ),
          );
        });

      return () => {
        isUnsubscribed = true;
      };
    });
  }
}
