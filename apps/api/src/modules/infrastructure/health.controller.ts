import { Controller, Get, Inject, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { IHealthProvider } from '@studyai/infrastructure';

@Controller('health')
export class HealthController {
  constructor(
    @Inject('IHealthProvider') private readonly healthProvider: IHealthProvider,
  ) {}

  @Get()
  async check(@Res() res: Response) {
    const timestamp = new Date().toISOString();
    
    // Check critical dependencies concurrently
    const [db, cache] = await Promise.all([
      this.healthProvider.checkDatabase().catch(e => ({ service: 'Database', status: 'DOWN' as const, latencyMs: 0 })),
      this.healthProvider.checkCache().catch(e => ({ service: 'Cache', status: 'DOWN' as const, latencyMs: 0 }))
    ]);

    const isReady = db.status === 'UP' && cache.status === 'UP';
    
    const response = {
      status: isReady ? 'ok' : 'error',
      timestamp,
      services: {
        database: db.status,
        cache: cache.status
      }
    };

    if (isReady) {
      return res.status(HttpStatus.OK).json(response);
    } else {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(response);
    }
  }
}
