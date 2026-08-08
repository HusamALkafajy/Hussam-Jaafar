import { NotFoundException } from '@nestjs/common';
import { once } from 'events';
import { Readable, Writable } from 'stream';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

type CapturedResponse = Writable & {
  status: jest.Mock;
  setHeader: jest.Mock;
  statusCode: number;
  headersSent: boolean;
  capturedHeaders: Map<string, string>;
  capturedChunks: Buffer[];
};

const createResponse = (): CapturedResponse => {
  const capturedHeaders = new Map<string, string>();
  const capturedChunks: Buffer[] = [];
  const response = new Writable({
    write(chunk, _encoding, callback) {
      capturedChunks.push(Buffer.from(chunk));
      callback();
    },
  }) as CapturedResponse;

  response.statusCode = 200;
  response.headersSent = false;
  response.capturedHeaders = capturedHeaders;
  response.capturedChunks = capturedChunks;
  response.status = jest.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.setHeader = jest.fn((name: string, value: string) => {
    capturedHeaders.set(name.toLowerCase(), String(value));
    return response;
  });
  return response;
};

describe('FilesController original-content Range contract', () => {
  const source = Buffer.alloc(2048, 0).map((_, index) => index % 251);
  const file = {
    originalName: 'range-contract.pdf',
    mimeType: 'application/pdf',
    storageKey: 'owner/file.pdf',
  };

  const createHarness = () => {
    const storageProvider = {
      exists: jest.fn().mockResolvedValue(true),
      getSize: jest.fn().mockResolvedValue(source.length),
      download: jest.fn().mockImplementation(
        async (_bucket: string, _key: string, range?: { start: number; end: number }) =>
          Readable.from(range ? source.subarray(range.start, range.end + 1) : source),
      ),
    };
    const service = Object.create(FilesService.prototype) as FilesService;
    Object.assign(service, {
      storageBucket: 'documents',
      storageProvider,
      findById: jest.fn().mockResolvedValue(file),
    });
    return {
      controller: new FilesController(service),
      service: service as FilesService & { findById: jest.Mock },
      storageProvider,
    };
  };

  const invoke = async (
    controller: FilesController,
    response: CapturedResponse,
    range?: string,
  ) => {
    const finished = once(response, 'finish');
    await controller.streamOriginalFile('owner-id', 'file-id', range, response as never);
    await finished;
    return Buffer.concat(response.capturedChunks);
  };

  it('preserves the first satisfiable byte range contract', async () => {
    const { controller, storageProvider } = createHarness();
    const response = createResponse();

    const body = await invoke(controller, response, 'bytes=0-1023');

    expect(response.status).toHaveBeenCalledWith(206);
    expect(response.capturedHeaders.get('accept-ranges')).toBe('bytes');
    expect(response.capturedHeaders.get('content-range')).toBe(`bytes 0-1023/${source.length}`);
    expect(response.capturedHeaders.get('content-length')).toBe('1024');
    expect(body).toEqual(source.subarray(0, 1024));
    expect(storageProvider.download).toHaveBeenCalledWith(
      'documents',
      file.storageKey,
      { start: 0, end: 1023 },
    );
  });

  it('preserves a later satisfiable byte range and its offsets', async () => {
    const { controller, storageProvider } = createHarness();
    const response = createResponse();

    const body = await invoke(controller, response, 'bytes=1024-1535');

    expect(response.status).toHaveBeenCalledWith(206);
    expect(response.capturedHeaders.get('content-range')).toBe(`bytes 1024-1535/${source.length}`);
    expect(response.capturedHeaders.get('content-length')).toBe('512');
    expect(body).toEqual(source.subarray(1024, 1536));
    expect(storageProvider.download).toHaveBeenCalledWith(
      'documents',
      file.storageKey,
      { start: 1024, end: 1535 },
    );
  });

  it('returns a bodyless 416 with the dynamic complete length for an unsatisfiable range', async () => {
    const { controller, storageProvider } = createHarness();
    const response = createResponse();
    const startBeyondEof = source.length + 10_000;

    const body = await invoke(controller, response, `bytes=${startBeyondEof}-`);

    expect(response.status).toHaveBeenCalledWith(416);
    expect(response.capturedHeaders.get('accept-ranges')).toBe('bytes');
    expect(response.capturedHeaders.get('content-range')).toBe(`bytes */${source.length}`);
    expect(response.capturedHeaders.get('content-length')).toBe('0');
    expect(body).toHaveLength(0);
    expect(storageProvider.download).not.toHaveBeenCalled();
  });

  it('preserves full-content 200 behavior when Range is absent', async () => {
    const { controller, storageProvider } = createHarness();
    const response = createResponse();

    const body = await invoke(controller, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.capturedHeaders.get('accept-ranges')).toBe('bytes');
    expect(response.capturedHeaders.has('content-range')).toBe(false);
    expect(response.capturedHeaders.get('content-length')).toBe(String(source.length));
    expect(body).toEqual(source);
    expect(storageProvider.download).toHaveBeenCalledWith('documents', file.storageKey, undefined);
  });

  it('does not disclose the protected size when ownership lookup fails', async () => {
    const { controller, service, storageProvider } = createHarness();
    const response = createResponse();
    service.findById.mockRejectedValueOnce(new NotFoundException('File not found'));

    await expect(
      controller.streamOriginalFile(
        'other-user-id',
        'file-id',
        `bytes=${source.length + 10_000}-`,
        response as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(service.findById).toHaveBeenCalledWith('file-id', 'other-user-id');
    expect(storageProvider.exists).not.toHaveBeenCalled();
    expect(storageProvider.getSize).not.toHaveBeenCalled();
    expect(storageProvider.download).not.toHaveBeenCalled();
    expect(response.setHeader).not.toHaveBeenCalled();
    expect(response.capturedHeaders.has('content-range')).toBe(false);
  });
});
