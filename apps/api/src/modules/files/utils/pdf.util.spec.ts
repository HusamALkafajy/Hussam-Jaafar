import { PdfUtility } from './pdf.util';
import { PDFDocument } from 'pdf-lib';

describe('PdfUtility', () => {
  let dummyPdfBuffer: Buffer;

  beforeAll(async () => {
    // Create a 10-page dummy PDF for testing
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < 10; i++) {
      const page = pdfDoc.addPage([500, 500]);
      page.drawText(`Page ${i + 1}`);
    }
    const pdfBytes = await pdfDoc.save();
    dummyPdfBuffer = Buffer.from(pdfBytes);
  });

  describe('getPageCount', () => {
    it('should correctly count pages of a valid PDF buffer', async () => {
      const count = await PdfUtility.getPageCount(dummyPdfBuffer);
      expect(count).toBe(10);
    });
  });

  describe('extractPageRange', () => {
    it('should correctly extract a slice of pages', async () => {
      const slicedBuffer = await PdfUtility.extractPageRange(dummyPdfBuffer, 3, 7);
      const newPdf = await PDFDocument.load(slicedBuffer);
      expect(newPdf.getPageCount()).toBe(5); // Pages 3, 4, 5, 6, 7 = 5 pages
    });

    it('should extract a single page correctly', async () => {
      const slicedBuffer = await PdfUtility.extractPageRange(dummyPdfBuffer, 5, 5);
      const newPdf = await PDFDocument.load(slicedBuffer);
      expect(newPdf.getPageCount()).toBe(1);
    });

    it('should throw an error if startPage is less than 1', async () => {
      await expect(PdfUtility.extractPageRange(dummyPdfBuffer, 0, 5)).rejects.toThrow(/out of bounds/);
    });

    it('should throw an error if endPage exceeds total pages', async () => {
      await expect(PdfUtility.extractPageRange(dummyPdfBuffer, 8, 15)).rejects.toThrow(/out of bounds/);
    });

    it('should throw an error if startPage > endPage', async () => {
      await expect(PdfUtility.extractPageRange(dummyPdfBuffer, 5, 4)).rejects.toThrow(/out of bounds/);
    });
  });
});
