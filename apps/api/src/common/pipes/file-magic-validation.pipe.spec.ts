import { BadRequestException } from '@nestjs/common';
import { FileMagicValidationPipe } from './file-magic-validation.pipe';

describe('FileMagicValidationPipe', () => {
  let pipe: FileMagicValidationPipe;

  beforeEach(() => {
    pipe = new FileMagicValidationPipe();
  });

  const createMockFile = (
    mimetype: string,
    buffer: Buffer,
    originalname: string = 'file.tmp',
    size: number = 1024,
  ): Express.Multer.File => {
    return {
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
    };
  };

  // Magic Byte Buffers
  const validPdfBytes = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.alloc(10)]);
  const validJpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(10)]);
  const validPngBytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(10)]);
  const validZipBytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(10)]);
  
  const legacyDocBytes = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.alloc(10)]);
  const randomBytes = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);

  it('1. genuine PDF bytes + PDF MIME -> accepted', () => {
    const file = createMockFile('application/pdf', validPdfBytes, 'test.pdf');
    const result = pipe.transform(file);
    expect(result.mimetype).toBe('application/pdf');
  });

  it('2. arbitrary bytes + PDF MIME -> rejected', () => {
    const file = createMockFile('application/pdf', randomBytes, 'test.pdf');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow('Unrecognized file signature');
  });

  it('3. arbitrary bytes + .pdf + PDF MIME -> rejected', () => {
    const file = createMockFile('application/pdf', randomBytes, 'test.pdf');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('4. legacy DOC -> rejected', () => {
    const file = createMockFile('application/msword', legacyDocBytes, 'test.doc');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('5. DOCX/ZIP bytes -> rejected while DOCX canonical support is absent', () => {
    const file = createMockFile('application/vnd.openxmlformats-officedocument.wordprocessingml.document', validZipBytes, 'test.docx');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow('Unrecognized file signature');
  });

  it('6. generic ZIP -> rejected', () => {
    const file = createMockFile('application/zip', validZipBytes, 'test.zip');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('7. APK/JAR-like ZIP container -> rejected', () => {
    const file = createMockFile('application/vnd.android.package-archive', validZipBytes, 'app.apk');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('8. JPEG -> rejected while image canonical support is absent', () => {
    const file = createMockFile('image/jpeg', validJpegBytes, 'test.jpeg');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow('Unsupported file format detected: image/jpeg');
  });

  it('9. image/jpg -> rejected', () => {
    const file = createMockFile('image/jpg', validJpegBytes, 'test.jpg');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow('Unsupported file format detected: image/jpeg');
  });

  it('10. PNG -> rejected', () => {
    const file = createMockFile('image/png', validPngBytes, 'test.png');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow('Unsupported file format detected: image/png');
  });

  it('11. arbitrary binary -> rejected', () => {
    const file = createMockFile('application/octet-stream', randomBytes, 'malware.exe');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });

  it('12. unsupported application/octet-stream -> rejected', () => {
    const file = createMockFile('application/octet-stream', validJpegBytes, 'test.jpg');
    expect(() => pipe.transform(file)).toThrow(BadRequestException);
  });
});
