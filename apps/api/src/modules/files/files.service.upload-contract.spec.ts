import { mkdtemp, readdir, rm, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FilesService } from './files.service';
import { MAX_UPLOAD_BYTES } from '../../common/files/upload-contract';

jest.mock('@studyai/database', () => ({
  db: {},
  files: {},
  subscriptions: {},
  users: {},
  subjects: {},
  fileProcessingAttempts: {},
  documentVersions: {},
  eq: jest.fn(),
  and: jest.fn(),
  or: jest.fn(),
  sql: jest.fn(),
  desc: jest.fn(),
}));

describe('FilesService chunk upload rejection contract', () => {
  let root: string;
  let service: FilesService;
  let register: jest.Mock;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'studyai-upload-unit-'));
    service = Object.create(FilesService.prototype) as FilesService;
    (service as any).uploadDir = root;
    register = jest.fn();
    (service as any).registerAndProcessFile = register;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function expectNoResidue(): Promise<void> {
    expect(await readdir(root)).toEqual([]);
    expect(register).not.toHaveBeenCalled();
  }

  it('rejects one byte over 50 MiB before persistence, storage, or queue dispatch', async () => {
    await expect(service.handleChunkUpload(
      'user-1',
      Buffer.from('%PDF'),
      '35b513fc-8162-4e05-93f0-ec6f7da0dc0b',
      0,
      26,
      'book.pdf',
      MAX_UPLOAD_BYTES + 1,
      'application/pdf',
    )).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: 'FILE_TOO_LARGE' }) });
    await expectNoResidue();
  });

  it('rejects unsupported or forged content without temporary residue', async () => {
    await expect(service.handleChunkUpload(
      'user-1',
      Buffer.from('fake'),
      '35b513fc-8162-4e05-93f0-ec6f7da0dc0b',
      0,
      1,
      'book.pdf',
      4,
      'application/pdf',
    )).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: 'UNSUPPORTED_FILE_TYPE' }) });
    await expectNoResidue();
  });

  it('preserves the selected subject and confirmed title through final registration', async () => {
    register.mockImplementation(async (
      _userId: string,
      filePath: string,
      _filename: string,
      _mime: string,
      _size: number,
      subjectId: string,
      title: string,
    ) => {
      await unlink(filePath);
      return { id: 'file-1', subjectId, title };
    });
    await expect(service.handleChunkUpload(
      'user-1',
      Buffer.from('%PDF'),
      '35b513fc-8162-4e05-93f0-ec6f7da0dc0b',
      0,
      1,
      'book.pdf',
      4,
      'application/pdf',
      '8b10ae20-f1b2-4c4a-91d9-61d408606de1',
      'كتاب الجبر',
    )).resolves.toMatchObject({
      subjectId: '8b10ae20-f1b2-4c4a-91d9-61d408606de1',
      title: 'كتاب الجبر',
    });
    expect(register).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      'book.pdf',
      'application/pdf',
      4,
      '8b10ae20-f1b2-4c4a-91d9-61d408606de1',
      'كتاب الجبر',
    );
    expect(await readdir(root)).toEqual(['temp']);
    expect(await readdir(join(root, 'temp'))).toEqual([]);
  });
});
