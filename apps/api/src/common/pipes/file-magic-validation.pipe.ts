import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

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
      label: 'DOCX/ZIP',
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      magic: Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK (ZIP)
    },
    {
      label: 'DOC (legacy Word)',
      mimeTypes: ['application/msword'],
      magic: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), // Compound Document
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

  private static readonly ALLOWED_MIMES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/webp',
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
    const buf = file.buffer;

    // ── Step 1: check declared MIME type ──────────────────────────────────
    const mimeAllowed = FileMagicValidationPipe.ALLOWED_MIMES.has(declaredMime);

    // ── Step 2: check magic bytes ─────────────────────────────────────────
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
            // RIFF without WEBP marker is not a recognized type — don't set detectedMime
          } else {
            detectedMime = sig.mimeTypes[0];
          }
          break;
        }
      }
    }

    const magicAllowed =
      detectedMime !== null &&
      FileMagicValidationPipe.ALLOWED_MIMES.has(detectedMime);

    // ── Step 3: Fallback check on original filename extension ─────────────────
    let extensionAllowed = false;
    if (!mimeAllowed && !magicAllowed && declaredMime === 'application/octet-stream' && file.originalname) {
      const lowerName = file.originalname.toLowerCase();
      if (lowerName.endsWith('.pdf')) {
        detectedMime = 'application/pdf';
        extensionAllowed = true;
      } else if (lowerName.endsWith('.doc')) {
        detectedMime = 'application/msword';
        extensionAllowed = true;
      } else if (lowerName.endsWith('.docx')) {
        detectedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        extensionAllowed = true;
      }
    }

    if (!mimeAllowed && !magicAllowed && !extensionAllowed) {
      throw new BadRequestException(
        `Only PDF, Word documents (.doc, .docx), and images (.png, .jpg, .jpeg, .webp) are allowed. ` +
          `Received MIME type: "${file.mimetype}"${detectedMime ? `, detected: "${detectedMime}"` : ' (unrecognized file signature)'}. ` +
          `If you are uploading a valid file, ensure your client sends the correct Content-Type header.`,
      );
    }

    // If magic bytes or extension identified a more specific MIME, normalise it so the
    // service layer sees the correct type (e.g. octet-stream → application/pdf).
    if (!mimeAllowed && (magicAllowed || extensionAllowed) && detectedMime) {
      file.mimetype = detectedMime;
    }

    return file;
  }
}
