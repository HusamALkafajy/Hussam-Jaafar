import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_VERSION = '6.2.108';
const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('pdfjs-dist/package.json');
const packageRoot = path.dirname(packageJsonPath);
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(webRoot, 'public', 'vendor', 'pdfjs');

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
if (packageJson.version !== EXPECTED_VERSION) {
  throw new Error(
    `Expected pdfjs-dist ${EXPECTED_VERSION}, but resolved ${String(packageJson.version)}.`,
  );
}

const assets = [
  { source: path.join(packageRoot, 'build', 'pdf.mjs'), destination: 'pdf.mjs' },
  {
    source: path.join(packageRoot, 'build', 'pdf.worker.min.mjs'),
    destination: 'pdf.worker.mjs',
  },
];

for (const asset of assets) {
  const sourceStat = await stat(asset.source).catch(() => undefined);
  if (!sourceStat?.isFile() || sourceStat.size === 0) {
    throw new Error(`Required PDF.js browser asset is missing or empty: ${asset.source}`);
  }
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const asset of assets) {
  const destination = path.join(outputDirectory, asset.destination);
  await copyFile(asset.source, destination);
  const destinationStat = await stat(destination);
  if (!destinationStat.isFile() || destinationStat.size === 0) {
    throw new Error(`Generated PDF.js browser asset is empty: ${destination}`);
  }
}

console.log(`Prepared PDF.js ${EXPECTED_VERSION} browser runtime and Worker assets.`);
