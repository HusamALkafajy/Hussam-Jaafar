import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FileProcessingDispatcherService } from './file-processing-dispatcher.service';
import { db, eq, and } from '@studyai/database';
import { IQueue } from '@studyai/infrastructure';
import { PdfUtility } from '../utils/pdf.util';

jest.mock('../utils/pdf.util', () => ({
  PdfUtility: {
    getPageCountFromFile: jest.fn(),
  },
}));

jest.mock('@studyai/database', () => {
  const dbMock = {
    update: jest.fn(),
    select: jest.fn(),
    transaction: jest.fn(),
    insert: jest.fn(),
  };
  return {
    db: dbMock,
    eq: jest.fn(),
    and: jest.fn(),
    or: jest.fn(),
    sql: jest.fn(),
    fileProcessingAttempts: { id: 'id', fileId: 'fileId', queueJobId: 'queueJobId', status: 'status' },
    files: { id: 'id', fileType: 'fileType' },
    processingSessions: { id: 'id', fileId: 'fileId', status: 'status', totalChunks: 'totalChunks' },
    processingCheckpoints: { id: 'id', sessionId: 'sessionId', chunkIndex: 'chunkIndex' },
  };
});

describe('FileProcessingDispatcherService', () => {
  let service: FileProcessingDispatcherService;
  let queue: jest.Mocked<IQueue>;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.ENABLE_V2_PIPELINE = 'false';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileProcessingDispatcherService,
        {
          provide: 'IQueue',
          useValue: {
            enqueue: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => process.env[key]),
          },
        },
      ],
    }).compile();

    service = module.get<FileProcessingDispatcherService>(FileProcessingDispatcherService);
    queue = module.get('IQueue');
  });

  describe('dispatchAttempt (V1 Legacy)', () => {
    it('should handle V1 dispatching when ENABLE_V2_PIPELINE=false', async () => {
      const attemptId = 'attempt-123';
      const expectedJobId = `file-processing_${attemptId}`;

      const returningMock = jest.fn().mockResolvedValue([{ id: attemptId, fileId: 'file-123', queueJobId: expectedJobId }]);
      const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
      const setMock = jest.fn().mockReturnValue({ where: whereMock });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });

      const fileResult = [{ id: 'file-123', fileType: 'pdf' }];
      const limitMock = jest.fn().mockResolvedValue(fileResult);
      const whereSelectMock = jest.fn().mockReturnValue({ limit: limitMock });
      const fromMock = jest.fn().mockReturnValue({ where: whereSelectMock });
      (db.select as jest.Mock).mockReturnValue({ from: fromMock });

      await service.dispatchAttempt(attemptId);

      expect(queue.enqueue).toHaveBeenCalledWith({
        jobId: expectedJobId,
        jobType: 'process-file',
        priority: 0,
        payload: { attemptId, fileId: 'file-123', traceId: expect.any(String) },
      });
    });

    it('should handle V1 dispatching for non-PDFs even when ENABLE_V2_PIPELINE=true', async () => {
      process.env.ENABLE_V2_PIPELINE = 'true';
      const attemptId = 'attempt-123';
      const expectedJobId = `file-processing_${attemptId}`;

      const returningMock = jest.fn().mockResolvedValue([{ id: attemptId, fileId: 'file-123', queueJobId: expectedJobId }]);
      const whereMock = jest.fn().mockReturnValue({ returning: returningMock });
      const setMock = jest.fn().mockReturnValue({ where: whereMock });
      (db.update as jest.Mock).mockReturnValue({ set: setMock });

      const fileResult = [{ id: 'file-123', fileType: 'docx' }]; // non-pdf
      const limitMock = jest.fn().mockResolvedValue(fileResult);
      const whereSelectMock = jest.fn().mockReturnValue({ limit: limitMock });
      const fromMock = jest.fn().mockReturnValue({ where: whereSelectMock });
      (db.select as jest.Mock).mockReturnValue({ from: fromMock });

      await service.dispatchAttempt(attemptId);

      expect(queue.enqueue).toHaveBeenCalledWith({
        jobId: expectedJobId,
        jobType: 'process-file',
        priority: 0,
        payload: { attemptId, fileId: 'file-123', traceId: expect.any(String) },
      });
    });
  });
});
