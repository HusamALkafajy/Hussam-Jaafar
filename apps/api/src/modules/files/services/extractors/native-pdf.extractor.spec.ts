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

  const createPdfBytes = async (setup: (doc: PDFDocument) => void): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    setup(doc);
    return Buffer.from(await doc.save());
  };

  const createPdfFile = async (name: string, setup: (doc: PDFDocument) => void): Promise<string> => {
    const bytes = await createPdfBytes(setup);
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, bytes);
    return filePath;
  };

  it('A. Buffer-preferred extraction: should extract correctly from context.data', async () => {
    const buffer = await createPdfBytes((doc) => {
      let page1 = doc.addPage([500, 500]);
      page1.drawText('Buffer Page One');

      let page2 = doc.addPage([500, 500]);
      page2.drawText('Buffer Page Two');
    });

    const result = await extractor.extract({ fileId: 'buf-1', data: buffer, mimeType: 'application/pdf' });
    expect(result.blocks).toHaveLength(3); // root + 2 pages
    expect(result.blocks[1].text).toContain('Buffer Page One');
    expect(result.blocks[1].metadata?.sourcePage).toBe(1);
    expect(result.blocks[2].text).toContain('Buffer Page Two');
    expect(result.blocks[2].metadata?.sourcePage).toBe(2);
    expect(result.metadata?.pageCount).toBe(2);
    expect(result.blocks[0].metadata).toMatchObject({ generatedRoot: true, pageCount: 2 });
  });

  it('B. Buffer precedence: should prefer data over filePath', async () => {
    const buffer = await createPdfBytes((doc) => {
      doc.addPage([500, 500]).drawText('From Buffer');
    });
    const fakeFilePath = '/tmp/does/not/exist.pdf';

    const result = await extractor.extract({ fileId: 'buf-2', data: buffer, filePath: fakeFilePath, mimeType: 'application/pdf' });
    expect(result.blocks[1].text).toContain('From Buffer');
  });

  it('records verified page count and per-page provenance without a native test runtime', async () => {
    const mockPdfjsLib = {
      OPS: {},
      getDocument: jest.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: 2,
          getPage: jest.fn()
            .mockResolvedValueOnce({ getTextContent: jest.fn().mockResolvedValue({ items: [{ str: 'Page One' }] }) })
            .mockResolvedValueOnce({ getTextContent: jest.fn().mockResolvedValue({ items: [{ str: 'Page Two' }] }) }),
        }),
        destroy: jest.fn(),
      }),
      createUint8Array: (buffer: Buffer) => new Uint8Array(buffer),
    };
    const testExtractor = new NativePdfExtractor(mockPdfjsLib);

    const result = await testExtractor.extract({
      fileId: 'page-provenance',
      data: Buffer.from('fixture'),
      mimeType: 'application/pdf',
    });

    expect(result.metadata?.pageCount).toBe(2);
    expect(result.blocks[0].metadata).toMatchObject({ generatedRoot: true, pageCount: 2 });
    expect(result.blocks[1].metadata?.sourcePage).toBe(1);
    expect(result.blocks[2].metadata?.sourcePage).toBe(2);
  });

  it('C. filePath fallback: should extract from filePath when data is missing', async () => {
    const filePath = await createPdfFile('fallback.pdf', (doc) => {
      doc.addPage([500, 500]).drawText('From File');
    });

    const result = await extractor.extract({ fileId: 'buf-3', filePath, mimeType: 'application/pdf' });
    expect(result.blocks[1].text).toContain('From File');
  });

  it('D. Missing input: should fail safely when both data and filePath are absent', async () => {
    await expect(extractor.extract({ fileId: 'buf-4', mimeType: 'application/pdf' }))
      .rejects.toThrow(MalformedDocumentError);
  });

  it('E. Malformed Buffer: should fail safely with invalid PDF bytes', async () => {
    const corruptBuffer = Buffer.from('Not a valid PDF');
    await expect(extractor.extract({ fileId: 'buf-5', data: corruptBuffer, mimeType: 'application/pdf' }))
      .rejects.toThrow(MalformedDocumentError);
  });

  it('H. Memory-view safety: should extract safely from sliced buffer', async () => {
    const rawBuffer = await createPdfBytes((doc) => {
      doc.addPage([500, 500]).drawText('Sliced Buffer Test');
    });
    const pool = Buffer.alloc(rawBuffer.length + 100);
    rawBuffer.copy(pool, 50);
    const slicedBuffer = pool.subarray(50, 50 + rawBuffer.length);

    const result = await extractor.extract({ fileId: 'buf-slice', data: slicedBuffer, mimeType: 'application/pdf' });
    expect(result.blocks[1].text).toContain('Sliced Buffer Test');
  });

  it('F. Image-only PDF: should throw MissingTextLayerError (OCR REQUIRED) (mocked)', async () => {
    const mockPdfjsLib = {
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
      createUint8Array: (buf: Buffer) => new Uint8Array(buf),
    };
    const testExtractor = new NativePdfExtractor(mockPdfjsLib);
    await expect(testExtractor.extract({ fileId: 'img-1', data: Buffer.from('dummy'), mimeType: 'application/pdf' }))
      .rejects.toThrow(MissingTextLayerError);
  });

  it('G. Empty PDF: should throw EmptyDocumentError for a completely blank page', async () => {
    const buffer = await createPdfBytes((doc) => {
      doc.addPage([500, 500]);
    });
    await expect(extractor.extract({ fileId: 'blank-1', data: buffer, mimeType: 'application/pdf' }))
      .rejects.toThrow(EmptyDocumentError);
  });

  it('G. Empty PDF: should throw EmptyDocumentError for a 0-page PDF', async () => {
    const mockPdfjsLib = {
      getDocument: jest.fn().mockReturnValue({
        promise: Promise.resolve({
          numPages: 0,
          getPage: jest.fn(),
          destroy: jest.fn(),
        }),
      }),
      createUint8Array: (buf: Buffer) => new Uint8Array(buf),
    };
    const testExtractor = new NativePdfExtractor(mockPdfjsLib);
    await expect(testExtractor.extract({ fileId: '0-page', data: Buffer.from('dummy'), mimeType: 'application/pdf' }))
      .rejects.toThrow(EmptyDocumentError);
  });

  it('should throw ExtractionResourceLimitError for a PDF exceeding MAX_EXTRACTION_PAGES', async () => {
    const filePath = await createPdfFile('large.pdf', (doc) => {
      for (let i = 0; i < 2001; i++) {
        doc.addPage([10, 10]);
      }
    });
    await expect(extractor.extract({ fileId: 'large-1', filePath, mimeType: 'application/pdf' }))
      .rejects.toThrow(ExtractionResourceLimitError);
  });

  it('should throw EncryptedDocumentError for password-protected PDF (mocked)', async () => {
    const mockPdfjsLib = {
      getDocument: jest.fn().mockReturnValue({
        promise: Promise.reject({ name: 'PasswordException', message: 'No password given' }),
      }),
      createUint8Array: (buf: Buffer) => new Uint8Array(buf),
    };
    const testExtractor = new NativePdfExtractor(mockPdfjsLib);
    await expect(testExtractor.extract({ fileId: 'enc-1', data: Buffer.from('dummy'), mimeType: 'application/pdf' }))
      .rejects.toThrow(EncryptedDocumentError);
  });

  it('should throw MalformedDocumentError when PDF file does not exist', async () => {
    await expect(extractor.extract({ fileId: 'test-file-5', filePath: '/invalid/path.pdf', mimeType: 'application/pdf' }))
      .rejects.toThrow(MalformedDocumentError);
  });
});
