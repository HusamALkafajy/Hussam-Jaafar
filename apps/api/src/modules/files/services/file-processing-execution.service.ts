import { Injectable, Logger } from '@nestjs/common';
import { db, eq, sql, files, subjects } from '@studyai/database';
import { AiService } from '../../ai/ai.service';
import * as mammoth from 'mammoth';
import { FileType } from '@studyai/types';

@Injectable()
export class FileProcessingExecutionService {
  private readonly logger = new Logger(FileProcessingExecutionService.name);

  constructor(
    private readonly aiService: AiService,
  ) {}

  async executeExtraction(
    fileId: string,
    filePath: string,
    type: FileType | string,
    mime: string,
    startPage?: number,
    endPage?: number
  ): Promise<string> {
    let extractedText = '';
    let targetFilePath = filePath;
    let isTempFile = false;

    try {
      if (type === 'pdf' && startPage !== undefined && endPage !== undefined) {
        const { PdfUtility } = await import('../utils/pdf.util');
        const { tmpdir } = await import('os');
        const { join } = await import('path');
        const { randomUUID } = await import('crypto');
        const fs = await import('fs/promises');

        const extractedBuffer = await PdfUtility.extractPageRangeFromFile(filePath, startPage, endPage);
        targetFilePath = join(tmpdir(), `${randomUUID()}.pdf`);
        isTempFile = true;
        await fs.writeFile(targetFilePath, extractedBuffer);
      }

      if (type === 'pdf' || type === 'image') {
        extractedText = await this.aiService.extractText(targetFilePath, mime);
      } else if (type === 'docx') {
        const result = await mammoth.extractRawText({ path: targetFilePath });
        extractedText = result.value;
      } else {
        throw new Error('Unsupported file type in pipeline');
      }
    } finally {
      if (isTempFile) {
        const fs = await import('fs/promises');
        await fs.unlink(targetFilePath).catch((err) => {
          this.logger.warn(`Failed to cleanup temp PDF ${targetFilePath}: ${err.message}`);
        });
      }
    }

    if (!extractedText || extractedText.trim() === '') {
      if (type === 'pdf' || type === 'image') {
        throw new Error('PDF/Image extraction returned no usable text. Failing explicitly to prevent empty publication.');
      }
      this.logger.warn(`Empty extracted text for File ID: ${fileId}. Saving fallback message.`);
      extractedText = 'No extractable text found in this document.';
    }

    return extractedText;
  }
}
