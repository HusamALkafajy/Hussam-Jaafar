import { HttpException, HttpStatus } from '@nestjs/common';
import { open, unlink } from 'fs/promises';
import type { FileHandle } from 'fs/promises';
import { extname } from 'path';
import { ALLOWED_UPLOAD_MIMES } from '../constants/file-formats.constant';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_CHUNKS = Math.ceil(MAX_UPLOAD_BYTES / UPLOAD_CHUNK_BYTES);
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const UploadErrorCode = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  INVALID_UPLOAD: 'INVALID_UPLOAD',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  STORAGE_FAILED: 'UPLOAD_STORAGE_FAILED',
  PROCESSING_FAILED: 'UPLOAD_PROCESSING_FAILED',
} as const;

export type UploadErrorCodeValue = typeof UploadErrorCode[keyof typeof UploadErrorCode];

export class UploadException extends HttpException {
  constructor(
    errorCode: UploadErrorCodeValue,
    message: string,
    status = HttpStatus.BAD_REQUEST,
    details: Record<string, unknown> = {},
  ) {
    super({ message, errorCode, ...details }, status);
  }
}

const MIME_ALIASES = new Map<string, string>([
  ['image/jpg', 'image/jpeg'],
  ['application/octet-stream', 'application/octet-stream'],
]);

const EXTENSION_MIMES = new Map<string, string>([
  ['.pdf', 'application/pdf'],
  ['.docx', DOCX_MIME],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

export function assertUploadSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new UploadException(UploadErrorCode.INVALID_UPLOAD, 'The uploaded file is empty or invalid.');
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new UploadException(
      UploadErrorCode.FILE_TOO_LARGE,
      'File size exceeds the 50 MiB limit.',
      HttpStatus.PAYLOAD_TOO_LARGE,
      { maxBytes: MAX_UPLOAD_BYTES },
    );
  }
}

function detectMagic(header: Buffer): string | undefined {
  if (header.subarray(0, 4).equals(Buffer.from('%PDF'))) return 'application/pdf';
  if (header.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';
  if (header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return DOCX_MIME;
  return undefined;
}

function normalizeDeclaredMime(value: string): string {
  const mime = value.toLowerCase().trim();
  return MIME_ALIASES.get(mime) ?? mime;
}

function assertMimeConsistency(detectedMime: string, declaredMime: string, originalName: string): void {
  const expectedMime = EXTENSION_MIMES.get(extname(originalName).toLowerCase());
  const normalizedDeclared = normalizeDeclaredMime(declaredMime);
  if (!expectedMime || expectedMime !== detectedMime || !ALLOWED_UPLOAD_MIMES.has(detectedMime)) {
    throw new UploadException(
      UploadErrorCode.UNSUPPORTED_FILE_TYPE,
      'Unsupported file type.',
    );
  }
  if (normalizedDeclared !== detectedMime && normalizedDeclared !== 'application/octet-stream') {
    throw new UploadException(
      UploadErrorCode.UNSUPPORTED_FILE_TYPE,
      'The declared file type does not match the uploaded content.',
    );
  }
}

interface ZipDirectoryEntry {
  compressedSize: number;
  localHeaderOffset: number;
  name: string;
}

function invalidDocx(): never {
  throw new UploadException(
    UploadErrorCode.UNSUPPORTED_FILE_TYPE,
    'The uploaded ZIP container is not a valid Word document.',
  );
}

function findZipDirectoryEntries(tail: Buffer, tailStart: number): ZipDirectoryEntry[] {
  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endOffset = tail.lastIndexOf(endSignature);
  if (endOffset < 0 || endOffset + 22 > tail.length) invalidDocx();

  const commentLength = tail.readUInt16LE(endOffset + 20);
  if (endOffset + 22 + commentLength !== tail.length) invalidDocx();
  if (tail.readUInt16LE(endOffset + 4) !== 0 || tail.readUInt16LE(endOffset + 6) !== 0) invalidDocx();

  const entryCount = tail.readUInt16LE(endOffset + 10);
  const directorySize = tail.readUInt32LE(endOffset + 12);
  const directoryOffset = tail.readUInt32LE(endOffset + 16);
  const localDirectoryOffset = directoryOffset - tailStart;
  const directoryEnd = localDirectoryOffset + directorySize;
  if (entryCount < 2 || localDirectoryOffset < 0 || directoryEnd > endOffset) invalidDocx();

  const entries: ZipDirectoryEntry[] = [];
  let offset = localDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > directoryEnd || tail.readUInt32LE(offset) !== 0x02014b50) invalidDocx();
    const compressedSize = tail.readUInt32LE(offset + 20);
    const nameLength = tail.readUInt16LE(offset + 28);
    const extraLength = tail.readUInt16LE(offset + 30);
    const commentLengthForEntry = tail.readUInt16LE(offset + 32);
    const localHeaderOffset = tail.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const nextOffset = nameEnd + extraLength + commentLengthForEntry;
    if (nameEnd > directoryEnd || nextOffset > directoryEnd) invalidDocx();
    entries.push({
      compressedSize,
      localHeaderOffset,
      name: tail.subarray(nameStart, nameEnd).toString('utf8'),
    });
    offset = nextOffset;
  }
  if (offset !== directoryEnd) invalidDocx();
  return entries;
}

async function assertLocalZipEntry(
  handle: FileHandle,
  size: number,
  entry: ZipDirectoryEntry,
): Promise<void> {
  const localHeader = Buffer.alloc(30);
  const headerRead = await handle.read(localHeader, 0, localHeader.length, entry.localHeaderOffset);
  if (headerRead.bytesRead !== localHeader.length || localHeader.readUInt32LE(0) !== 0x04034b50) invalidDocx();
  const nameLength = localHeader.readUInt16LE(26);
  const extraLength = localHeader.readUInt16LE(28);
  const nameBytes = Buffer.alloc(nameLength);
  const nameRead = await handle.read(nameBytes, 0, nameLength, entry.localHeaderOffset + 30);
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
  if (
    nameRead.bytesRead !== nameLength ||
    nameBytes.toString('utf8') !== entry.name ||
    dataStart + entry.compressedSize > size
  ) invalidDocx();
}

async function assertDocxContainer(
  handle: FileHandle,
  size: number,
  tail: Buffer,
): Promise<void> {
  const tailStart = size - tail.length;
  const entries = findZipDirectoryEntries(tail, tailStart);
  const requiredEntries = ['[Content_Types].xml', 'word/document.xml'].map((name) =>
    entries.find((entry) => entry.name === name),
  );
  if (requiredEntries.some((entry) => !entry)) invalidDocx();
  await Promise.all(requiredEntries.map((entry) => assertLocalZipEntry(handle, size, entry!)));
}

export function validateUploadHeader(
  header: Buffer,
  declaredMime: string,
  originalName: string,
): string {
  const detectedMime = detectMagic(header);
  if (!detectedMime) {
    throw new UploadException(
      UploadErrorCode.UNSUPPORTED_FILE_TYPE,
      'Unrecognized file signature.',
    );
  }
  assertMimeConsistency(detectedMime, declaredMime, originalName);
  return detectedMime;
}

export async function validateUploadPath(
  filePath: string,
  declaredMime: string,
  originalName: string,
  size: number,
): Promise<string> {
  assertUploadSize(size);
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    const headerRead = await handle.read(header, 0, header.length, 0);
    const detected = detectMagic(header.subarray(0, headerRead.bytesRead));
    let directoryBytes: Buffer | undefined;
    if (detected === DOCX_MIME) {
      const tailLength = Math.min(size, 1024 * 1024);
      directoryBytes = Buffer.alloc(tailLength);
      await handle.read(directoryBytes, 0, tailLength, size - tailLength);
      await assertDocxContainer(handle, size, directoryBytes);
    }
    return validateUploadHeader(header.subarray(0, headerRead.bytesRead), declaredMime, originalName);
  } finally {
    await handle.close();
  }
}

export async function removeUploadTempFile(filePath?: string): Promise<void> {
  if (filePath) await unlink(filePath).catch(() => undefined);
}

export function isMulterFileSizeError(exception: unknown): boolean {
  return Boolean(
    exception &&
    typeof exception === 'object' &&
    'code' in exception &&
    (exception as { code?: string }).code === 'LIMIT_FILE_SIZE',
  );
}

export function uploadFileSizeException(): UploadException {
  return new UploadException(
    UploadErrorCode.FILE_TOO_LARGE,
    'File size exceeds the 50 MiB limit.',
    HttpStatus.PAYLOAD_TOO_LARGE,
    { maxBytes: MAX_UPLOAD_BYTES },
  );
}
