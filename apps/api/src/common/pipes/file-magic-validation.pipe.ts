import { Injectable, PipeTransform } from '@nestjs/common';
import {
  assertUploadSize,
  removeUploadTempFile,
  validateUploadHeader,
  validateUploadPath,
} from '../files/upload-contract';

/**
 * Validates the actual upload signature and canonical MIME contract. Direct
 * multipart uploads are spooled to disk, so validation reads only a bounded
 * header/tail window rather than buffering the complete document.
 */
@Injectable()
export class FileMagicValidationPipe implements PipeTransform {
  async transform(file: Express.Multer.File): Promise<Express.Multer.File> {
    if (!file) {
      validateUploadHeader(Buffer.alloc(0), '', '');
    }

    try {
      assertUploadSize(file.size);
      file.mimetype = file.path
        ? await validateUploadPath(file.path, file.mimetype, file.originalname, file.size)
        : validateUploadHeader(file.buffer, file.mimetype, file.originalname);
      return file;
    } catch (error) {
      await removeUploadTempFile(file.path);
      throw error;
    }
  }
}
