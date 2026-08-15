import { inflateRawSync } from 'zlib';

interface ZipEntry {
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function findCentralDirectoryEntry(buffer: Buffer, targetName: string): ZipEntry | undefined {
  const signatureBytes = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  let offset = buffer.indexOf(signatureBytes);
  while (offset >= 0 && offset + 46 <= buffer.length) {
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > buffer.length) return undefined;
    const filename = buffer.subarray(nameStart, nameEnd).toString('utf8');
    if (filename === targetName) {
      return { compressionMethod, compressedSize, localHeaderOffset };
    }
    const nextOffset = nameEnd + extraLength + commentLength;
    offset = nextOffset + 4 <= buffer.length && buffer.readUInt32LE(nextOffset) === 0x02014b50
      ? nextOffset
      : buffer.indexOf(signatureBytes, nextOffset);
  }
  return undefined;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): Buffer | undefined {
  const offset = entry.localHeaderOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) return undefined;
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) return undefined;
  const compressed = buffer.subarray(dataStart, dataEnd);
  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed, { maxOutputLength: 1024 * 1024 });
  }
  return undefined;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hexadecimal: string) => String.fromCodePoint(parseInt(hexadecimal, 16)));
}

export function extractDocxTitle(buffer: Buffer): string | undefined {
  try {
    const entry = findCentralDirectoryEntry(buffer, 'docProps/core.xml');
    if (!entry) return undefined;
    const xml = readZipEntry(buffer, entry)?.toString('utf8');
    const match = xml?.match(/<dc:title(?:\s[^>]*)?>([\s\S]*?)<\/dc:title>/i);
    return match ? decodeXmlText(match[1]).trim() : undefined;
  } catch {
    return undefined;
  }
}
