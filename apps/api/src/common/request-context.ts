import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestLogContext {
  requestId: string;
  readonly user?: { role?: string };
}

export const requestContext = new AsyncLocalStorage<RequestLogContext>();

export function requestContextMiddleware(req: any, res: any, next: () => void) {
  const suppliedRequestId = req.get?.('x-request-id');
  const requestId =
    typeof suppliedRequestId === 'string' && suppliedRequestId.trim()
      ? suppliedRequestId.trim().slice(0, 128)
      : randomUUID();
  res.setHeader?.('x-request-id', requestId);
  requestContext.run(
    {
      requestId,
      get user() {
        return req.user;
      },
    },
    next,
  );
}
