import * as fs from 'fs';
import * as path from 'path';

const sourceRoot = path.resolve(__dirname, '../..');
const structuredLoggerSink = path.resolve(__dirname, 'structured-logger.ts');
const consoleCall = /\bconsole\.(?:log|warn|error|debug|info)\s*\(/;

function productionTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === 'scratch' ? [] : productionTypeScriptFiles(absolutePath);
    }

    if (
      !entry.name.endsWith('.ts') ||
      entry.name.endsWith('.spec.ts') ||
      entry.name.endsWith('.test.ts') ||
      entry.name === 'scratch_test.ts'
    ) {
      return [];
    }

    return [absolutePath];
  });
}

describe('production logging boundary', () => {
  it.each([
    'console.error({ jwt: "VALIDATION_ONLY_TOKEN" });',
    'console.warn({ Authorization: "VALIDATION_ONLY_AUTH" });',
    'console.log({ DATABASE_URL: "VALIDATION_ONLY_DATABASE" });',
    'console.debug({ body: "VALIDATION_ONLY_BODY" });',
    'console.info({ rawOutput: "VALIDATION_ONLY_OUTPUT" });',
  ])('detects a prohibited direct-output fixture: %s', (source) => {
    expect(consoleCall.test(source)).toBe(true);
  });

  it('allows direct console emission only inside StructuredLogger', () => {
    const violations = productionTypeScriptFiles(sourceRoot)
      .filter((filePath) => path.resolve(filePath) !== structuredLoggerSink)
      .flatMap((filePath) => {
        const source = fs.readFileSync(filePath, 'utf8');
        return consoleCall.test(source)
          ? [path.relative(sourceRoot, filePath).split(path.sep).join('/')]
          : [];
      });

    expect(violations).toEqual([]);
  });
});
