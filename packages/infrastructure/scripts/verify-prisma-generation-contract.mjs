import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, '..');
const sourceSchema = resolve(packageDirectory, 'prisma', 'schema.prisma');
const temporaryDirectory = mkdtempSync(join(packageDirectory, '.prisma-generate-test-'));
const temporarySchemaDirectory = join(temporaryDirectory, 'prisma');
const temporarySchema = join(temporarySchemaDirectory, 'schema.prisma');

function redact(output) {
  return output
    .replace(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/\S+/giu, '[REDACTED_URL]')
    .replace(/(DATABASE_URL\s*[=:]\s*)\S+/giu, '$1[REDACTED]');
}

try {
  mkdirSync(temporarySchemaDirectory, { recursive: true });
  cpSync(sourceSchema, temporarySchema);

  const require = createRequire(import.meta.url);
  const prismaCli = require.resolve('prisma/build/index.js', {
    paths: [packageDirectory],
  });
  const prismaEnvironment = { ...process.env };
  delete prismaEnvironment.DATABASE_URL;
  const result = spawnSync(
    process.execPath,
    [prismaCli, 'generate', '--schema', temporarySchema],
    {
      cwd: packageDirectory,
      encoding: 'utf8',
      env: prismaEnvironment,
    },
  );

  if (result.status !== 0) {
    const diagnostic = redact(`${result.stdout ?? ''}${result.stderr ?? ''}`.trim());
    throw new Error(`Prisma generation contract failed.\n${diagnostic}`);
  }

  const generatedClient = join(temporaryDirectory, 'src', 'prisma-client', 'index.js');
  if (!existsSync(generatedClient)) {
    throw new Error('Prisma generation completed without producing the expected client.');
  }

  console.log('Prisma generation contract passed without database access.');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
