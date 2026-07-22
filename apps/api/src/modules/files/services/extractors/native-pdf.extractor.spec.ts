import { NativePdfExtractor } from './native-pdf.extractor';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  EmptyDocumentError,
  MissingTextLayerError,
  EncryptedDocumentError,
  MalformedDocumentError,
  ExtractionResourceLimitError,
} from '../../../../modules/files/contracts/document-extractor';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

describe('NativePdfExtractor', () => {
  let extractor: NativePdfExtractor;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-test-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    extractor = new NativePdfExtractor();
  });

  const createPdfFile = async (name: string, setup: (doc: PDFDocument) => void): Promise<string> => {
    const doc = await PDFDocument.create();
    setup(doc);
    const bytes = await doc.save();
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, bytes);
    return filePath;
  };

  it('should extract text from a single-page PDF', async () => {
    const filePath = await createPdfFile('single.pdf', (doc) => {
      const page = doc.addPage([500, 500]);
      page.drawText('Hello World');
    });

    const result = await extractor.extract({ fileId: 'test-file-1', filePath, mimeType: 'application/pdf' });
    expect(result.fullText).toContain('Hello World');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].text).toContain('Hello World');
    expect(result.blocks[0].metadata?.sourcePage).toBe(1);
  });

  it('should extract text from a multi-page PDF with deterministic page provenance', async () => {
    const filePath = await createPdfFile('multi.pdf', (doc) => {
      let page1 = doc.addPage([500, 500]);
      page1.drawText('Page One Text');

      let page2 = doc.addPage([500, 500]);
      page2.drawText('Page Two Text');
    });

    const result = await extractor.extract({ fileId: 'test-file-2', filePath, mimeType: 'application/pdf' });
    expect(result.blocks).toHaveLength(2);

    expect(result.blocks[0].text).toContain('Page One Text');
    expect(result.blocks[0].metadata?.sourcePage).toBe(1);

    expect(result.blocks[1].text).toContain('Page Two Text');
    expect(result.blocks[1].metadata?.sourcePage).toBe(2);

    expect(result.fullText).toContain('Page One Text');
  });

  it('should throw EmptyDocumentError for a 0-page PDF', async () => {
    jest.resetModules();
    jest.doMock('pdfjs-dist/legacy/build/pdf.js', () => ({
      getDocument: jest.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: 0,
          getPage: jest.fn(),
          destroy: jest.fn(),
        }),
      }),
    }));

    const { NativePdfExtractor } = await import('./native-pdf.extractor');
    const testExtractor = new NativePdfExtractor();

    const fs = require('fs');
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('dummy'));

    await expect(testExtractor.extract({ fileId: 'test-file-3', filePath: 'dummy.pdf', mimeType: 'application/pdf' }))
      .rejects.toThrow('The PDF document contains 0 pages.');

    jest.unmock('pdfjs-dist/legacy/build/pdf.js');
    jest.restoreAllMocks();
  });

  it('should throw EmptyDocumentError for a PDF with a completely blank page (no visual ops)', async () => {
    const filePath = await createPdfFile('blank.pdf', (doc) => {
      doc.addPage([500, 500]); // No text, no drawing
    });

    await expect(extractor.extract({ fileId: 'test-file-blank', filePath, mimeType: 'application/pdf' }))
      .rejects.toThrow(EmptyDocumentError);
  });

  it('should throw ExtractionResourceLimitError for a PDF exceeding MAX_EXTRACTION_PAGES', async () => {
    // Generate a 2001-page PDF using pdf-lib (very fast for blank pages)
    const filePath = await createPdfFile('large.pdf', (doc) => {
      for (let i = 0; i < 2001; i++) {
        doc.addPage([10, 10]);
      }
    });

    await expect(extractor.extract({ fileId: 'test-file-large', filePath, mimeType: 'application/pdf' }))
      .rejects.toThrow(ExtractionResourceLimitError);
  });

  it('should throw EncryptedDocumentError for password-protected PDF (mocked)', async () => {
    jest.resetModules();
    jest.doMock('pdfjs-dist/legacy/build/pdf.js', () => ({
      getDocument: jest.fn().mockReturnValue({
        promise: Promise.reject({ name: 'PasswordException', message: 'No password given' }),
      }),
    }));

    const { NativePdfExtractor } = await import('./native-pdf.extractor');
    const testExtractor = new NativePdfExtractor();

    const fs = require('fs');
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('dummy'));

    await expect(testExtractor.extract({ fileId: 'test-file-enc', filePath: 'dummy.pdf', mimeType: 'application/pdf' }))
      .rejects.toThrow('The PDF is encrypted and requires a password.');

    jest.unmock('pdfjs-dist/legacy/build/pdf.js');
    jest.restoreAllMocks();
  });

  it('should throw MissingTextLayerError (OCR REQUIRED) for an image-only PDF with 0 text items (mocked)', async () => {
    jest.resetModules();
    jest.doMock('pdfjs-dist/legacy/build/pdf.js', () => ({
      OPS: { paintXObject: 85 },
      getDocument: jest.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          getPage: jest.fn().mockResolvedValue({
            getTextContent: jest.fn().mockResolvedValue({ items: [] }),
            getOperatorList: jest.fn().mockResolvedValue({ fnArray: [85] }),
          }),
        }),
      }),
    }));

    const { NativePdfExtractor } = await import('./native-pdf.extractor');
    const testExtractor = new NativePdfExtractor();
    const fs = require('fs');
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('dummy'));

    await expect(testExtractor.extract({ fileId: 'test-file-img', filePath: 'dummy.pdf', mimeType: 'application/pdf' }))
      .rejects.toThrow('No text items found, but visual content detected. Document requires OCR.');

    jest.unmock('pdfjs-dist/legacy/build/pdf.js');
    jest.restoreAllMocks();
  });

  it('should throw MalformedDocumentError when PDF file does not exist', async () => {
    await expect(extractor.extract({ fileId: 'test-file-5', filePath: '/invalid/path.pdf', mimeType: 'application/pdf' }))
      .rejects.toThrow(MalformedDocumentError);
  });

  it('should throw MalformedDocumentError for an invalid PDF byte stream', async () => {
    const filePath = path.join(tmpDir, 'corrupt.pdf');
    fs.writeFileSync(filePath, Buffer.from('Not a PDF file'));

    await expect(extractor.extract({ fileId: 'test-file-6', filePath, mimeType: 'application/pdf' }))
      .rejects.toThrow(MalformedDocumentError);
  });
});
