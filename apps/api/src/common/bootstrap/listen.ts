import type { INestApplication } from '@nestjs/common';

/** Preserve Nest's historical overload unless a listen host is configured. */
export async function listenApi(
  app: Pick<INestApplication, 'listen'>,
  port: number,
  host?: string,
): Promise<void> {
  if (host !== undefined) {
    await app.listen(port, host);
  } else {
    await app.listen(port);
  }
}
