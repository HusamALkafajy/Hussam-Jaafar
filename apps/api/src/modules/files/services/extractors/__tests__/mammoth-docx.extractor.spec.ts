import { MammothDocxExtractor } from '../mammoth-docx.extractor';
import { 
  DocumentExtractionContext, 
  EmptyDocumentError, 
  MalformedDocumentError, 
  ExtractionResourceLimitError 
} from '../../../contracts/document-extractor';
import * as mammoth from 'mammoth';
import * as fs from 'fs';

// Mock fs and mammoth
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));
jest.mock('mammoth', () => ({
  convertToHtml: jest.fn(),
}));

describe('MammothDocxExtractor', () => {
  let extractor: MammothDocxExtractor;

  beforeEach(() => {
    extractor = new MammothDocxExtractor();
    jest.clearAllMocks();
  });

  describe('extract', () => {
    it('should throw MalformedDocumentError if no filePath is provided', async () => {
      const context: DocumentExtractionContext = { fileId: 'f1', filePath: '', mimeType: 'docx' };
      await expect(extractor.extract(context)).rejects.toThrow(MalformedDocumentError);
    });

    it('should throw MalformedDocumentError if file read fails', async () => {
      (fs.promises.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      const context: DocumentExtractionContext = { fileId: 'f1', filePath: 'fake.docx', mimeType: 'docx' };
      await expect(extractor.extract(context)).rejects.toThrow(MalformedDocumentError);
    });

    it('should throw ExtractionResourceLimitError if file is too large', async () => {
      const hugeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB
      (fs.promises.readFile as jest.Mock).mockResolvedValue(hugeBuffer);
      const context: DocumentExtractionContext = { fileId: 'f1', filePath: 'huge.docx', mimeType: 'docx' };
      await expect(extractor.extract(context)).rejects.toThrow(ExtractionResourceLimitError);
    });

    it('should throw EmptyDocumentError if Mammoth yields empty HTML', async () => {
      (fs.promises.readFile as jest.Mock).mockResolvedValue(Buffer.from('fake'));
      (mammoth.convertToHtml as jest.Mock).mockResolvedValue({ value: '', messages: [] });
      
      const context: DocumentExtractionContext = { fileId: 'f1', filePath: 'empty.docx', mimeType: 'docx' };
      await expect(extractor.extract(context)).rejects.toThrow(EmptyDocumentError);
    });

    it('should extract paragraphs successfully', async () => {
      (fs.promises.readFile as jest.Mock).mockResolvedValue(Buffer.from('fake'));
      (mammoth.convertToHtml as jest.Mock).mockResolvedValue({ 
        value: '<p>Hello world</p>', 
        messages: [] 
      });
      
      const context: DocumentExtractionContext = { fileId: 'f1', filePath: 'doc.docx', mimeType: 'docx' };
      const doc = await extractor.extract(context);
      
      expect(doc.blocks).toHaveLength(1);
      expect(doc.blocks[0]).toMatchObject({
        type: 'paragraph',
        text: 'Hello world'
      });
    });

    it('should extract headings successfully', async () => {
      (fs.promises.readFile as jest.Mock).mockResolvedValue(Buffer.from('fake'));
      (mammoth.convertToHtml as jest.Mock).mockResolvedValue({ 
        value: '<h1>Title</h1><h2>Subtitle</h2>', 
        messages: [] 
      });
      
      const context: DocumentExtractionContext = { fileId: 'f1', filePath: 'doc.docx', mimeType: 'docx' };
      const doc = await extractor.extract(context);
      
      expect(doc.blocks).toHaveLength(2);
      expect(doc.blocks[0]).toMatchObject({ type: 'heading_1', text: 'Title' });
      expect(doc.blocks[1]).toMatchObject({ type: 'heading_2', text: 'Subtitle' });
    });

    it('should extract nested lists and tables successfully', async () => {
      (fs.promises.readFile as jest.Mock).mockResolvedValue(Buffer.from('fake'));
      (mammoth.convertToHtml as jest.Mock).mockResolvedValue({ 
        value: '<ul><li>Item 1</li><li>Item 2<ul><li>Nested</li></ul></li></ul><table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>', 
        messages: [] 
      });
      
      const context: DocumentExtractionContext = { fileId: 'f1', filePath: 'doc.docx', mimeType: 'docx' };
      const doc = await extractor.extract(context);
      
      // 3 list items + 1 table
      expect(doc.blocks).toHaveLength(4);
      expect(doc.blocks[0]).toMatchObject({ type: 'list_item', text: 'Item 1' });
      expect(doc.blocks[1]).toMatchObject({ type: 'list_item', text: 'Item 2' });
      expect(doc.blocks[2]).toMatchObject({ type: 'list_item', text: 'Nested' });
      expect(doc.blocks[3]).toMatchObject({ type: 'table' });
    });
  });
});
