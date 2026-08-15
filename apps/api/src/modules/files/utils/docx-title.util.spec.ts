import { extractDocxTitle } from './docx-title.util';

function createStoredZipEntry(filename: string, content: string): Buffer {
  const filenameBytes = Buffer.from(filename, 'utf8');
  const contentBytes = Buffer.from(content, 'utf8');

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(contentBytes.length, 18);
  localHeader.writeUInt16LE(contentBytes.length, 22);
  localHeader.writeUInt16LE(filenameBytes.length, 26);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(contentBytes.length, 20);
  centralHeader.writeUInt16LE(contentBytes.length, 24);
  centralHeader.writeUInt16LE(filenameBytes.length, 28);

  const centralDirectory = Buffer.concat([centralHeader, filenameBytes]);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(1, 8);
  endOfCentralDirectory.writeUInt16LE(1, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(
    localHeader.length + filenameBytes.length + contentBytes.length,
    16,
  );

  return Buffer.concat([
    localHeader,
    filenameBytes,
    contentBytes,
    centralDirectory,
    endOfCentralDirectory,
  ]);
}

describe('extractDocxTitle', () => {
  it('reads and decodes the core document title without a ZIP dependency', () => {
    const docx = createStoredZipEntry(
      'docProps/core.xml',
      '<?xml version="1.0"?><cp:coreProperties><dc:title>Physics &amp; Motion</dc:title></cp:coreProperties>',
    );

    expect(extractDocxTitle(docx)).toBe('Physics & Motion');
  });

  it('fails closed to no metadata for malformed or title-less containers', () => {
    expect(extractDocxTitle(Buffer.from('not-a-zip'))).toBeUndefined();
    expect(extractDocxTitle(createStoredZipEntry('word/document.xml', '<w:document/>')))
      .toBeUndefined();
  });
});
