import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';

export class PdfUtility {
  /**
   * Returns the total number of pages in a PDF document.
   * @param buffer The raw PDF buffer
   * @returns Total number of pages
   */
  static async getPageCount(buffer: Buffer): Promise<number> {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  }

  /**
   * Extracts a specific range of pages from a source PDF and returns a new PDF buffer.
   * Both startPage and endPage are 1-indexed and inclusive.
   * @param buffer The raw PDF buffer
   * @param startPage 1-indexed start page
   * @param endPage 1-indexed end page
   * @returns A Buffer containing only the extracted pages
   */
  static async extractPageRange(buffer: Buffer, startPage: number, endPage: number): Promise<Buffer> {
    const sourcePdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = sourcePdf.getPageCount();

    if (startPage < 1 || startPage > totalPages) {
      throw new Error(`startPage ${startPage} is out of bounds (1-${totalPages})`);
    }
    if (endPage < startPage || endPage > totalPages) {
      throw new Error(`endPage ${endPage} is out of bounds (${startPage}-${totalPages})`);
    }

    // PDF-lib indices are 0-based
    const indicesToCopy = [];
    for (let i = startPage - 1; i < endPage; i++) {
      indicesToCopy.push(i);
    }

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(sourcePdf, indicesToCopy);

    for (const page of copiedPages) {
      newPdf.addPage(page);
    }

    const pdfBytes = await newPdf.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Helper to perform page counting directly from a file path.
   */
  static async getPageCountFromFile(filePath: string): Promise<number> {
    const buffer = await fs.readFile(filePath);
    return this.getPageCount(buffer);
  }

  /**
   * Helper to perform page extraction directly from a file path.
   */
  static async extractPageRangeFromFile(filePath: string, startPage: number, endPage: number): Promise<Buffer> {
    const buffer = await fs.readFile(filePath);
    return this.extractPageRange(buffer, startPage, endPage);
  }
}
