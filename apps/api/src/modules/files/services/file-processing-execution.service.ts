import { Injectable, Logger } from '@nestjs/common';
import { db, eq, sql, files, subjects } from '@studyai/database';
import { AiService } from '../../ai/ai.service';
import * as mammoth from 'mammoth';
import { FileType } from '@studyai/types';

export interface FileExecutionResult {
  extractedText: string;
  error?: string;
}

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
    mime: string
  ): Promise<FileExecutionResult> {
    try {
      let extractedText = '';

      if (type === 'pdf' || type === 'image') {
        extractedText = await this.aiService.extractText(filePath, mime);
      } else if (type === 'docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        extractedText = result.value;
      } else {
        throw new Error('Unsupported file type in pipeline');
      }

      if (!extractedText || extractedText.trim() === '') {
        this.logger.warn(`Empty extracted text for File ID: ${fileId}. Saving fallback message.`);
        extractedText = 'No extractable text found in this document.';
      }

      return { extractedText };
    } catch (e: any) {
      this.logger.error(`Extraction failed for File ID: ${fileId}`, e);
      return { extractedText: '', error: e?.message || 'Unknown processing error' };
    }
  }

}
