import { LegacyFallbackAdapter } from './legacy-fallback.adapter';
import { AiService } from '../../../ai/ai.service';
import { MissingTextLayerError } from '../../contracts/document-extractor';

describe('LegacyFallbackAdapter', () => {
  let adapter: LegacyFallbackAdapter;
  let mockAiService: jest.Mocked<AiService>;

  beforeEach(() => {
    mockAiService = {
      extractText: jest.fn(),
    } as any;

    adapter = new LegacyFallbackAdapter(mockAiService);
  });

  it('should route pdf to aiService and map to ExtractedDocument', async () => {
    mockAiService.extractText.mockResolvedValue('Extracted pdf text');
    const result = await adapter.extract({
      fileId: '123',
      filePath: '/tmp/test.pdf',
      mimeType: 'application/pdf',
      fileType: 'pdf'
    });

    expect(mockAiService.extractText).toHaveBeenCalledWith('/tmp/test.pdf', 'application/pdf');
    expect(result.fullText).toBe('Extracted pdf text');
    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0].text).toBe('Extracted pdf text');
  });

  it('should route image to aiService', async () => {
    mockAiService.extractText.mockResolvedValue('Extracted image text');
    const result = await adapter.extract({
      fileId: '123',
      filePath: '/tmp/test.png',
      mimeType: 'image/png',
      fileType: 'image'
    });

    expect(mockAiService.extractText).toHaveBeenCalledWith('/tmp/test.png', 'image/png');
    expect(result.fullText).toBe('Extracted image text');
  });

  it('should explicitly fail with MissingTextLayerError if AI extraction returns empty text', async () => {
    mockAiService.extractText.mockResolvedValue('   ');
    await expect(adapter.extract({
      fileId: '123',
      filePath: '/tmp/test.pdf',
      mimeType: 'application/pdf',
      fileType: 'pdf'
    })).rejects.toThrow(MissingTextLayerError);
  });

  it('should throw Error for unsupported legacy type', async () => {
    await expect(adapter.extract({
      fileId: '123',
      filePath: '/tmp/test.unknown',
      mimeType: 'application/octet-stream',
      fileType: 'unknown'
    })).rejects.toThrow('Legacy adapter does not support file type: unknown');
  });
});
