import { FileMagicValidationPipe } from './file-magic-validation.pipe';
import { MAX_UPLOAD_BYTES } from '../files/upload-contract';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('FileMagicValidationPipe', () => {
  const pipe = new FileMagicValidationPipe();

  const file = (
    mimetype: string,
    buffer: Buffer,
    originalname: string,
    size = buffer.length,
  ): Express.Multer.File => ({
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size,
    buffer,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  });

  const pdf = Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(12)]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
  const webp = Buffer.from('RIFF0000WEBP', 'ascii');
  const zip = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from('[Content_Types].xml word/document.xml'),
  ]);

  it.each([
    ['application/pdf', pdf, 'book.pdf', 'application/pdf'],
    ['image/jpeg', jpeg, 'page.jpg', 'image/jpeg'],
    ['image/png', png, 'page.png', 'image/png'],
    ['image/webp', webp, 'page.webp', 'image/webp'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip, 'book.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ])('accepts canonical %s content', async (declared, bytes, name, expected) => {
    await expect(pipe.transform(file(declared, bytes, name))).resolves.toMatchObject({ mimetype: expected });
  });

  it('accepts exactly 50 MiB', async () => {
    await expect(pipe.transform(file('application/pdf', pdf, 'book.pdf', MAX_UPLOAD_BYTES))).resolves.toBeDefined();
  });

  it('rejects one byte over 50 MiB with a stable code', async () => {
    await expect(pipe.transform(file('application/pdf', pdf, 'book.pdf', MAX_UPLOAD_BYTES + 1)))
      .rejects.toMatchObject({ response: expect.objectContaining({ errorCode: 'FILE_TOO_LARGE' }) });
  });

  it.each([
    ['arbitrary PDF bytes', 'application/pdf', Buffer.from('not-pdf'), 'book.pdf'],
    ['generic ZIP', 'application/zip', zip, 'archive.zip'],
    ['extension mismatch', 'image/png', png, 'page.pdf'],
    ['declared MIME mismatch', 'image/jpeg', png, 'page.png'],
  ])('rejects %s', async (_case, declared, bytes, name) => {
    await expect(pipe.transform(file(declared, bytes, name)))
      .rejects.toMatchObject({ response: expect.objectContaining({ errorCode: 'UNSUPPORTED_FILE_TYPE' }) });
  });

  it('rejects a forged DOCX whose ZIP header only contains expected filenames', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studyai-forged-docx-'));
    const filePath = join(root, 'forged.docx');
    await writeFile(filePath, zip);
    try {
      await expect(pipe.transform({
        ...file('application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip, 'forged.docx'),
        path: filePath,
      })).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: 'UNSUPPORTED_FILE_TYPE' }),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
