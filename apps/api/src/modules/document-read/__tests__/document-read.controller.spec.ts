import { Test, TestingModule } from '@nestjs/testing';
import { DocumentReadController } from '../document-read.controller';
import { DocumentReadService } from '../document-read.service';
import { DocumentQueryService } from '@studyai/database';
import { BadRequestException } from '@nestjs/common';

jest.mock('@studyai/database');

describe('DocumentReadController', () => {
  let controller: DocumentReadController;
  let service: DocumentReadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentReadController],
      providers: [DocumentReadService],
    }).compile();

    controller = module.get<DocumentReadController>(DocumentReadController);
    service = module.get<DocumentReadService>(DocumentReadService);
    
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNode', () => {
    it('should return node data', async () => {
      const mockResult = { data: { id: '123' }, diagnostics: { duration_ms: 5 } };
      (DocumentQueryService.getNode as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getNode('123');
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException if node not found', async () => {
      (DocumentQueryService.getNode as jest.Mock).mockResolvedValue({ data: null });
      await expect(controller.getNode('123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDescendants', () => {
    it('should clamp depth limit to 20 for safety', async () => {
      const mockResult = { data: [], diagnostics: { duration_ms: 1 } };
      (DocumentQueryService.getDescendants as jest.Mock).mockResolvedValue(mockResult);

      await controller.getDescendants('123', { depthLimit: 100 });
      expect(DocumentQueryService.getDescendants).toHaveBeenCalledWith('123', 20);
    });
  });

  describe('expandContext', () => {
    it('should clamp before and after limits to 50', async () => {
      const mockResult = { data: [], diagnostics: { duration_ms: 1 } };
      (DocumentQueryService.expandContext as jest.Mock).mockResolvedValue(mockResult);

      await controller.expandContext('123', { before: 100, after: 100 });
      expect(DocumentQueryService.expandContext).toHaveBeenCalledWith('123', 50, 50);
    });
  });
});
