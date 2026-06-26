import { Test, TestingModule } from '@nestjs/testing';
import { FileProcessingExecutionService } from './file-processing-execution.service';
import { AiService } from '../../ai/ai.service';
import * as mammoth from 'mammoth';

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}));

describe('FileProcessingExecutionService', () => {
  let service: FileProcessingExecutionService;
  let aiService: AiService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileProcessingExecutionService,
        {
          provide: AiService,
          useValue: {
            extractText: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FileProcessingExecutionService>(FileProcessingExecutionService);
    aiService = module.get<AiService>(AiService);
  });

  it('should process PDF using AI extraction', async () => {
    (aiService.extractText as jest.Mock).mockResolvedValue('PDF content');
    const result = await service.executeExtraction('file-1', 'path.pdf', 'pdf', 'application/pdf');

    expect(result.extractedText).toBe('PDF content');
    expect(aiService.extractText).toHaveBeenCalledWith('path.pdf', 'application/pdf');
  });

  it('should process image using AI extraction', async () => {
    (aiService.extractText as jest.Mock).mockResolvedValue('Image content');
    const result = await service.executeExtraction('file-2', 'path.jpg', 'image', 'image/jpeg');

    expect(result.extractedText).toBe('Image content');
    expect(aiService.extractText).toHaveBeenCalledWith('path.jpg', 'image/jpeg');
  });

  it('should process DOCX using Mammoth extraction', async () => {
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: 'DOCX content' });
    const result = await service.executeExtraction('file-3', 'path.docx', 'docx', 'application/docx');

    expect(result.extractedText).toBe('DOCX content');
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ path: 'path.docx' });
  });

  it('should handle empty extracted text by providing fallback message', async () => {
    (aiService.extractText as jest.Mock).mockResolvedValue('   ');
    const result = await service.executeExtraction('file-4', 'path.pdf', 'pdf', 'application/pdf');

    expect(result.extractedText).toBe('No extractable text found in this document.');
  });

  it('should propagate extraction error safely', async () => {
    (aiService.extractText as jest.Mock).mockRejectedValue(new Error('AI failed'));
    const result = await service.executeExtraction('file-5', 'path.pdf', 'pdf', 'application/pdf');

    expect(result.extractedText).toBe('');
    expect(result.error).toBe('AI failed');
  });

  it('should reject unsupported file types safely', async () => {
    const result = await service.executeExtraction('file-6', 'path.txt', 'txt', 'text/plain');

    expect(result.extractedText).toBe('');
    expect(result.error).toBe('Unsupported file type in pipeline');
  });
});
