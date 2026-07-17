import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from './rag.service';
import { AiService } from '../ai/ai.service';
import { db } from '@studyai/database';

jest.mock('@studyai/database', () => {
  const original = jest.requireActual('@studyai/database');
  
  const insertValuesMock = jest.fn().mockResolvedValue([]);
  const insertMock = jest.fn().mockReturnValue({ values: insertValuesMock });
  
  return {
    ...original,
    db: {
      delete: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
      insert: insertMock,
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    },
  };
});

describe('RagService', () => {
  let service: RagService;
  let aiService: jest.Mocked<AiService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: AiService,
          useValue: {
            getEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
          },
        },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
    aiService = module.get(AiService);
  });

  describe('indexFile (V1)', () => {
    it('should delete before insert and swallow embedding errors', async () => {
      // Mock failure for the second chunk
      aiService.getEmbedding
        .mockResolvedValueOnce([0.1])
        .mockRejectedValueOnce(new Error('API failure'))
        .mockResolvedValueOnce([0.2]);

      // A simple 3-page text (will generate multiple chunks)
      const text = `This is a very long string that represents the content of Page 1 which is more than thirty characters.\fThis is a very long string that represents the content of Page 2 which is more than thirty characters.\fThis is a very long string that represents the content of Page 3 which is more than thirty characters.`;
      
      await service.indexFile('file-123', text);
      
      expect(db.delete).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();
      
      const insertMock = db.insert as jest.Mock;
      const valuesMock = insertMock.mock.results[0].value.values as jest.Mock;
      const values = valuesMock.mock.calls[0][0];
      
      // We expect 3 chunks generated. The 2nd failed embedding, so only 2 were inserted!
      expect(values).toHaveLength(2);
      expect(values[0].content).toBe('This is a very long string that represents the content of Page 1 which is more than thirty characters.');
      expect(values[1].content).toBe('This is a very long string that represents the content of Page 3 which is more than thirty characters.');
    });
  });

  describe('generateChunkValues (V2)', () => {
    it('should generate properly mapped payload without db mutations', async () => {
      const text = `This is a very long string that represents the content of Page 1 which is more than thirty characters.\fThis is a very long string that represents the content of Page 2 which is more than thirty characters.`;
      
      const result = await service.generateChunkValues('file-123', text, 5); // startPage 5
      
      // Should generate 2 chunks
      expect(result).toHaveLength(2);
      
      // Chunk 0
      expect(result[0]).toEqual({
        fileId: 'file-123',
        chunkIndex: 0,
        content: 'This is a very long string that represents the content of Page 1 which is more than thirty characters.',
        pageNumber: 5, // 5 - 1 + 1
        embedding: [0.1, 0.2, 0.3],
      });

      // Chunk 1
      expect(result[1]).toEqual({
        fileId: 'file-123',
        chunkIndex: 1,
        content: 'This is a very long string that represents the content of Page 2 which is more than thirty characters.',
        pageNumber: 6, // 5 - 1 + 2
        embedding: [0.1, 0.2, 0.3],
      });

      // NO DB CALLS
      expect(db.delete).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should throw immediately on embedding failure', async () => {
      const text = `This is a very long string that represents the content of Page 1 which is more than thirty characters.\fThis is a very long string that represents the content of Page 2 which is more than thirty characters.`;
      aiService.getEmbedding.mockRejectedValueOnce(new Error('Fatal API Error'));

      await expect(service.generateChunkValues('file-123', text, 1))
        .rejects
        .toThrow('Fatal API Error');
      
      expect(db.delete).not.toHaveBeenCalled();
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should return empty array for empty text', async () => {
      const result = await service.generateChunkValues('file-123', '', 1);
      expect(result).toEqual([]);
      expect(aiService.getEmbedding).not.toHaveBeenCalled();
    });
  });
});
