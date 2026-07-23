import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ALLOWED_UPLOAD_MIMES } from '../constants/file-formats.constant';

/**
 * A robust file validation pipe that checks BOTH the declared MIME type AND
 * the file's actual magic bytes (file signature).
 *
 * Rationale: NestJS's built-in FileTypeValidator relies solely on
 * `file.mimetype`, which is taken from the Content-Type header sent by the
 * client. Many tools (curl, Postman, some browsers) send PDFs with
 * `application/octet-stream` instead of `application/pdf`, causing the
 * built-in validator to reject a perfectly valid PDF file.
 *
 * This pipe accepts the file if EITHER:
 *   a) the declared mimetype matches the allowlist, OR
 *   b) the file's first bytes match a known magic-byte signature.
 */
@Injectable()
export class FileMagicValidationPipe implements PipeTransform {
  /**
   * Known magic-byte signatures.
   * Each entry maps a human-readable label to a Buffer prefix.
   */
  private static readonly MAGIC_SIGNATURES: Array<{
    label: string;
    mimeTypes: string[];
    magic: Buffer;
  }> = [
    {
      label: 'PDF',
      mimeTypes: ['application/pdf'],
      magic: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
    },

    {
      label: 'PNG',
      mimeTypes: ['image/png'],
      magic: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // .PNG
    },
    {
      label: 'JPEG',
      mimeTypes: ['image/jpeg'],
      magic: Buffer.from([0xff, 0xd8, 0xff]),
    },
    {
      label: 'WEBP',
      mimeTypes: ['image/webp'],
      // RIFF....WEBP — check bytes 0-3 for RIFF + bytes 8-11 for WEBP
      magic: Buffer.from([0x52, 0x49, 0x46, 0x46]), // RIFF (additional WEBP check in transform)
    },
  ];



  private static readonly MIME_ALIASES = new Map<string, string>([
    ['image/jpg', 'image/jpeg'],
  ]);

  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }

    // ── Size check ────────────────────────────────────────────────────────
    if (file.size > FileMagicValidationPipe.MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds the 10 MB limit.');
    }

    const declaredMime = (file.mimetype || '').toLowerCase().trim();
    const normalizedDeclaredMime = FileMagicValidationPipe.MIME_ALIASES.get(declaredMime) || declaredMime;
    const buf = file.buffer;

    // ── Step 1: Detect MIME from magic bytes ──────────────────────────────
    let detectedMime: string | null = null;
    if (buf && buf.length >= 4) {
      for (const sig of FileMagicValidationPipe.MAGIC_SIGNATURES) {
        if (buf.subarray(0, sig.magic.length).equals(sig.magic)) {
          // Extra check for WEBP: bytes 8-11 must be "WEBP"
          if (sig.label === 'WEBP') {
            if (
              buf.length >= 12 &&
              buf.subarray(8, 12).toString('ascii') === 'WEBP'
            ) {
              detectedMime = 'image/webp';
            }
          } else {
            detectedMime = sig.mimeTypes[0];
          }
          break;
        }
      }
    }

    if (!detectedMime) {
      throw new BadRequestException('Unrecognized file signature.');
    }

    if (!ALLOWED_UPLOAD_MIMES.has(detectedMime)) {
      throw new BadRequestException(`Unsupported file format detected: ${detectedMime}`);
    }

    // ── Step 2: Ensure consistency between declared and detected ──────────
    let isConsistent = normalizedDeclaredMime === detectedMime;

    // Allow application/octet-stream if the file extension matches the detected type
    if (!isConsistent && normalizedDeclaredMime === 'application/octet-stream' && file.originalname) {
      const lowerName = file.originalname.toLowerCase();
      if (detectedMime === 'application/pdf' && lowerName.endsWith('.pdf')) isConsistent = true;
    }

    if (!isConsistent) {
      throw new BadRequestException(
        `File format mismatch. Declared: ${file.mimetype}, Detected: ${detectedMime}. ` +
        `If you are uploading a valid file, ensure your client sends the correct Content-Type header.`
      );
    }

    // Set the normalized mime type for the service layer
    file.mimetype = detectedMime;

    return file;
  }
}
