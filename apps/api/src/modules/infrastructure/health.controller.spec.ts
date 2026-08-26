import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { IHealthProvider, HealthStatus } from '@studyai/infrastructure';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthProvider: jest.Mocked<IHealthProvider>;
  let mockResponse: any;

  beforeEach(async () => {
    mockHealthProvider = {
      checkDatabase: jest.fn(),
      checkQueue: jest.fn(),
      checkWorkerRuntime: jest.fn(),
      checkOutbox: jest.fn(),
      checkEventDispatcher: jest.fn(),
      checkCache: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: 'IHealthProvider',
          useValue: mockHealthProvider,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return 200 OK when critical dependencies are UP', async () => {
    mockHealthProvider.checkDatabase.mockResolvedValue({ service: 'Database', status: 'UP', latencyMs: 10 });
    mockHealthProvider.checkCache.mockResolvedValue({ service: 'Cache', status: 'UP', latencyMs: 5 });

    await controller.check(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ok',
      services: { database: 'UP', cache: 'UP' }
    }));
  });

  it('should return 503 SERVICE_UNAVAILABLE when database is DOWN', async () => {
    mockHealthProvider.checkDatabase.mockResolvedValue({ service: 'Database', status: 'DOWN', latencyMs: 10 });
    mockHealthProvider.checkCache.mockResolvedValue({ service: 'Cache', status: 'UP', latencyMs: 5 });

    await controller.check(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      services: { database: 'DOWN', cache: 'UP' }
    }));
  });

  it('should return 503 SERVICE_UNAVAILABLE when cache is DOWN', async () => {
    mockHealthProvider.checkDatabase.mockResolvedValue({ service: 'Database', status: 'UP', latencyMs: 10 });
    mockHealthProvider.checkCache.mockResolvedValue({ service: 'Cache', status: 'DOWN', latencyMs: 5 });

    await controller.check(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      services: { database: 'UP', cache: 'DOWN' }
    }));
  });

  it('should return 503 SERVICE_UNAVAILABLE when provider throws an error', async () => {
    mockHealthProvider.checkDatabase.mockRejectedValue(new Error('Connection failed'));
    mockHealthProvider.checkCache.mockResolvedValue({ service: 'Cache', status: 'UP', latencyMs: 5 });

    await controller.check(mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      services: { database: 'DOWN', cache: 'UP' }
    }));
  });
});
