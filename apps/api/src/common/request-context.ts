import { AsyncLocalStorage } from 'async_hooks';

export const requestContext = new AsyncLocalStorage<any>();

export function requestContextMiddleware(req: any, res: any, next: () => void) {
  requestContext.run(req, next);
}
