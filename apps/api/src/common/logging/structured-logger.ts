import { ConsoleLogger, LoggerService } from '@nestjs/common';
import { requestContext } from '../request-context';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY =
  /(password|passphrase|access.?token|refresh.?token|authorization|cookie|secret|api.?key|email|jwt|prompt|raw.?response|response.?text|csrf|query|string.?params|search.?params)/i;
const URL_WITH_QUERY = /((?:https?:\/\/|\/)[^\s"'<>?]+)\?[^\s"'<>]*/gi;
const DATABASE_OR_CACHE_URL =
  /\b(?:postgres(?:ql)?|redis(?:s)?|mysql|mariadb|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi;
const CREDENTIAL_URL =
  /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@/\s]+@[^\s"'<>]+/gi;
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_TOKEN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const SENSITIVE_INLINE_VALUE =
  /((?:oauth.?code|oauth.?state|csrf(?:.?token)?|x-csrf-token|client.?secret)\s*[:=]\s*)(Bearer\s+[^\s,;]+|"[^"]*"|'[^']*'|[^\s,;]+)/gi;

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

export function redactLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return value
      .replace(URL_WITH_QUERY, '$1')
      .replace(DATABASE_OR_CACHE_URL, REDACTED)
      .replace(CREDENTIAL_URL, REDACTED)
      .replace(EMAIL_ADDRESS, REDACTED)
      .replace(JWT_TOKEN, REDACTED)
      .replace(SENSITIVE_INLINE_VALUE, '$1' + REDACTED)
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
      .replace(
        /((?:password|passphrase|access.?token|refresh.?token|authorization|cookie|secret|api.?key)\s*[:=]\s*)(Bearer\s+[^\s,;]+|"[^"]*"|'[^']*'|[^\s,;]+)/gi,
        `$1${REDACTED}`,
      );
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactLogValue(value.message, seen),
      ...(value.stack ? { stack: redactLogValue(value.stack, seen) } : {}),
      ...('cause' in value && value.cause !== undefined
        ? { cause: redactLogValue(value.cause, seen) }
        : {}),
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactLogValue(entry, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    sanitized[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactLogValue(entry, seen);
  }
  return sanitized;
}

export class StructuredLogger implements LoggerService {
  private readonly developmentLogger: ConsoleLogger;

  constructor(
    private readonly production = false,
    private readonly source = 'StudyAI',
  ) {
    this.developmentLogger = new ConsoleLogger(source);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    const safeMessage = redactLogValue(message);
    const safeParams = optionalParams.map((param) => redactLogValue(param));

    if (!this.production) {
      this.developmentLogger[level](safeMessage as any, ...safeParams);
      return;
    }

    const context = requestContext.getStore();
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      source: this.source,
      requestId: context?.requestId,
      message: safeMessage,
      ...(safeParams.length > 0 ? { context: safeParams } : {}),
    };
    const serialized = JSON.stringify(entry);
    if (level === 'error' || level === 'fatal') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }
}
