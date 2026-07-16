import { Test, TestingModule } from '@nestjs/testing';
import { FileProcessingExecutionService } from './file-processing-execution.service';
import { AiService } from '../../ai/ai.service';
import * as mammoth from 'mammoth';

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('../utils/pdf.util', () => ({
  PdfUtility: {
    extractPageRangeFromFile: jest.fn(),
  },
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

    expect(result).toBe('PDF content');
    expect(aiService.extractText).toHaveBeenCalledWith('path.pdf', 'application/pdf');
  });

  it('should process image using AI extraction', async () => {
    (aiService.extractText as jest.Mock).mockResolvedValue('Image content');
    const result = await service.executeExtraction('file-2', 'path.jpg', 'image', 'image/jpeg');

    expect(result).toBe('Image content');
    expect(aiService.extractText).toHaveBeenCalledWith('path.jpg', 'image/jpeg');
  });

  it('should process DOCX using Mammoth extraction', async () => {
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: 'DOCX content' });
    const result = await service.executeExtraction('file-3', 'path.docx', 'docx', 'application/docx');

    expect(result).toBe('DOCX content');
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ path: 'path.docx' });
  });

  it('should handle empty extracted text by providing fallback message', async () => {
    (aiService.extractText as jest.Mock).mockResolvedValue('   ');
    const result = await service.executeExtraction('file-4', 'path.pdf', 'pdf', 'application/pdf');

    expect(result).toBe('No extractable text found in this document.');
  });

  it('should throw an error if the AI service fails for PDF', async () => {
    const error = new Error('AI extraction failed');
    (aiService.extractText as jest.Mock).mockRejectedValue(error);

    await expect(
      service.executeExtraction('file-5', 'path.pdf', 'pdf', 'application/pdf')
    ).rejects.toThrow('AI extraction failed');
  });

  it('should throw an error for unsupported file types', async () => {
    await expect(
      service.executeExtraction('file-6', 'path.txt', 'txt' as any, 'text/plain')
    ).rejects.toThrow('Unsupported file type in pipeline');
  });

  it('should remove temp file after successful subset extraction', async () => {
    const { PdfUtility } = require('../utils/pdf.util');
    const fs = require('fs/promises');
    
    PdfUtility.extractPageRangeFromFile.mockResolvedValue(Buffer.from('pdf data'));
    fs.writeFile.mockResolvedValue(undefined);
    fs.unlink.mockResolvedValue(undefined);
    (aiService.extractText as jest.Mock).mockResolvedValue('Subset PDF content');

    const result = await service.executeExtraction('file-7', 'path.pdf', 'pdf', 'application/pdf', 1, 5);

    expect(result).toBe('Subset PDF content');
    expect(PdfUtility.extractPageRangeFromFile).toHaveBeenCalledWith('path.pdf', 1, 5);
    expect(fs.writeFile).toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalled();
  });

  it('should remove temp file even if extraction throws', async () => {
    const { PdfUtility } = require('../utils/pdf.util');
    const fs = require('fs/promises');
    
    PdfUtility.extractPageRangeFromFile.mockResolvedValue(Buffer.from('pdf data'));
    fs.writeFile.mockResolvedValue(undefined);
    fs.unlink.mockResolvedValue(undefined);
    (aiService.extractText as jest.Mock).mockRejectedValue(new Error('AI Failed subset'));

    await expect(
      service.executeExtraction('file-8', 'path.pdf', 'pdf', 'application/pdf', 1, 5)
    ).rejects.toThrow('AI Failed subset');

    expect(fs.unlink).toHaveBeenCalled();
  });
});
