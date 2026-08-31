#!/usr/bin/env node

import {
  closeSync,
  createReadStream,
  createWriteStream,
  fstatSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const image = process.argv[2];
if (!image || process.argv.length !== 3) {
  console.error('Usage: node scripts/verify-api-runtime-image.mjs <image>');
  process.exit(2);
}

const tempRoot = mkdtempSync(join(tmpdir(), 'studyai-api-image-gate-'));
const containerName = `studyai-api-image-gate-${process.pid}-${Date.now()}`;
const violations = [];
let containerCreated = false;
let scannedFiles = 0;
let scannedLayers = 0;

const universalContentPatterns = [
  ['credential canary', /credential-canary-9f6e/],
  ['authorization canary', /authorization-canary/],
  ['URL canary', /url-canary/],
  ['account canary', /account-canary/],
  ['prompt canary', /prompt-canary/],
  ['generated-content canary', /generated-canary/],
  ['document canary', /document-canary/],
  ['user canary', /user-canary/],
  ['provider-body canary', /provider-body-canary/],
  ['stack canary', /stack-canary/],
  ['Windows owner path', /C:\\Users\\Hussam\\/i],
  ['portable owner path', /C:\/Users\/Hussam\//i],
  ['owner download path', /ViberDownloads/i],
  ['owner workspace name', /studyai-p0-v2-clean/i],
];

const sensitiveContentPatterns = [
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['credentialed PostgreSQL URL', /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/i],
  ['credentialed Redis URL', /rediss?:\/\/[^\s:@/]*:[^\s@/]+@/i],
  ['JWT-shaped token', /eyJhbGciOi[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{16,}/],
  ['OpenAI-style key', /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ['GitHub token', /gh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{30,}/],
];

const applicationArtifactPath = /(^|\/)(?:__tests__|__mocks__|tests?|e2e|coverage|playwright-report|test-results|e2e-results)(\/|$)|\.(?:spec|test)\.[cm]?[jt]sx?$|(^|\/)\.env(?:\.|$)|(^|\/)\.git(\/|$)|(^|\/)\.storage(\/|$)|(^|\/)(?:StudyAI_[^/]*\.md|[^/]+\.(?:patch|diff|rej|orig|bak))$/i;
const globalOwnerArtifactPath = /(^|\/)\.git(\/|$)|(^|\/)\.storage(\/|$)|(^|\/)StudyAI_[^/]*\.md$|(^|\/)[^/]+\.(?:patch|diff|rej|orig)$/i;

function run(command, args, label, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    const detail = result.error?.message || result.stderr?.trim() || `exit ${result.status}`;
    throw new Error(`${label} failed: ${detail}`);
  }
  return result;
}

function readExactly(fd, offset, length) {
  const buffer = Buffer.alloc(length);
  let cursor = 0;
  while (cursor < length) {
    const count = readSync(fd, buffer, cursor, length - cursor, offset + cursor);
    if (count === 0) throw new Error('unexpected end of tar archive');
    cursor += count;
  }
  return buffer;
}

function tarString(buffer) {
  const zero = buffer.indexOf(0);
  return buffer.subarray(0, zero === -1 ? buffer.length : zero).toString('utf8').trim();
}

function tarNumber(buffer) {
  if ((buffer[0] & 0x80) !== 0) {
    let value = BigInt(buffer[0] & 0x7f);
    for (let index = 1; index < buffer.length; index += 1) value = (value << 8n) | BigInt(buffer[index]);
    return Number(value);
  }
  const value = tarString(buffer).replace(/\0/g, '').trim();
  return value ? Number.parseInt(value, 8) : 0;
}

function parsePax(buffer) {
  const result = {};
  let cursor = 0;
  while (cursor < buffer.length) {
    const space = buffer.indexOf(0x20, cursor);
    if (space === -1) break;
    const length = Number.parseInt(buffer.subarray(cursor, space).toString('ascii'), 10);
    if (!Number.isFinite(length) || length <= 0 || cursor + length > buffer.length) break;
    const record = buffer.subarray(space + 1, cursor + length - 1).toString('utf8');
    const equals = record.indexOf('=');
    if (equals !== -1) result[record.slice(0, equals)] = record.slice(equals + 1);
    cursor += length;
  }
  return result;
}

function normalizeTarPath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
}

function visitTar(filePath, { baseOffset = 0, byteLength, onEntry }) {
  const fd = openSync(filePath, 'r');
  try {
    const archiveEnd = baseOffset + (byteLength ?? (fstatSync(fd).size - baseOffset));
    let cursor = baseOffset;
    let nextPax = {};
    let globalPax = {};
    let longName;

    while (cursor + 512 <= archiveEnd) {
      const header = readExactly(fd, cursor, 512);
      if (header.every((byte) => byte === 0)) break;

      const rawName = tarString(header.subarray(0, 100));
      const prefix = tarString(header.subarray(345, 500));
      const headerName = prefix ? `${prefix}/${rawName}` : rawName;
      const type = String.fromCharCode(header[156] || 48);
      const headerSize = tarNumber(header.subarray(124, 136));
      const dataOffset = cursor + 512;

      if (type === 'x' || type === 'g') {
        if (headerSize > 16 * 1024 * 1024) throw new Error('oversized tar metadata entry');
        const pax = parsePax(readExactly(fd, dataOffset, headerSize));
        if (type === 'g') globalPax = { ...globalPax, ...pax };
        else nextPax = pax;
      } else if (type === 'L') {
        if (headerSize > 16 * 1024 * 1024) throw new Error('oversized tar long-name entry');
        longName = tarString(readExactly(fd, dataOffset, headerSize));
      } else {
        const pax = { ...globalPax, ...nextPax };
        const name = normalizeTarPath(pax.path || longName || headerName);
        const size = pax.size ? Number.parseInt(pax.size, 10) : headerSize;
        const linkName = pax.linkpath || tarString(header.subarray(157, 257));
        onEntry({ fd, name, type, size, dataOffset, linkName });
        nextPax = {};
        longName = undefined;
      }

      cursor = dataOffset + Math.ceil(headerSize / 512) * 512;
      if (cursor > archiveEnd) throw new Error('tar entry extends beyond archive boundary');
    }
  } finally {
    closeSync(fd);
  }
}

function scanText(text, displayPath, { sensitive = true } = {}) {
  const patterns = sensitive ? [...universalContentPatterns, ...sensitiveContentPatterns] : universalContentPatterns;
  for (const [label, pattern] of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) violations.push(`${displayPath}: ${label}`);
  }
}

function scanEntryContent(fd, offset, size, displayPath, { sensitive }) {
  scannedFiles += 1;
  const chunkSize = 1024 * 1024;
  let cursor = 0;
  let carry = '';
  const matched = new Set();
  const buffer = Buffer.alloc(Math.min(chunkSize, Math.max(size, 1)));
  while (cursor < size) {
    const expected = Math.min(buffer.length, size - cursor);
    const count = readSync(fd, buffer, 0, expected, offset + cursor);
    if (count === 0) throw new Error(`unexpected end of file content for ${displayPath}`);
    const text = carry + buffer.subarray(0, count).toString('latin1');
    const patterns = sensitive ? [...universalContentPatterns, ...sensitiveContentPatterns] : universalContentPatterns;
    for (const [label, pattern] of patterns) {
      pattern.lastIndex = 0;
      if (!matched.has(label) && pattern.test(text)) matched.add(label);
    }
    carry = text.slice(-512);
    cursor += count;
  }
  for (const label of matched) violations.push(`${displayPath}: ${label}`);
}

function scanTar(filePath, { baseOffset = 0, byteLength, label, requireCompleteRoot = false }) {
  const rootEntries = new Set();
  let apiRootSeen = false;

  visitTar(filePath, {
    baseOffset,
    byteLength,
    onEntry(entry) {
      const { fd, name, type, size, dataOffset, linkName } = entry;
      if (!name) return;
      scanText(`${name}\n${linkName || ''}`, `${label}/metadata`, { sensitive: false });

      const dependencyOwned = name.includes('/node_modules/');
      if (!dependencyOwned && globalOwnerArtifactPath.test(name)) {
        violations.push(`${label}: owner/local artifact path ${name}`);
      }

      const apiPrefix = 'app/apps/api';
      if (name === apiPrefix) apiRootSeen = true;
      if (name.startsWith(`${apiPrefix}/`)) {
        apiRootSeen = true;
        const applicationPath = name.slice(apiPrefix.length + 1);
        rootEntries.add(applicationPath.split('/')[0]);
        const applicationDependency = applicationPath === 'node_modules' || applicationPath.startsWith('node_modules/');
        if (!applicationDependency && applicationArtifactPath.test(applicationPath)) {
          violations.push(`${label}: application artifact ${applicationPath}`);
        }
        if (applicationPath.startsWith('uploads/') && (type === '0' || type === '7')) {
          violations.push(`${label}: upload payload ${applicationPath}`);
        }
      }

      if ((type === '0' || type === '7') && size >= 0) {
        const applicationOwned = name.startsWith('app/apps/api/') && !name.includes('/node_modules/');
        scanEntryContent(fd, dataOffset, size, `${label}/${name}`, { sensitive: applicationOwned });
      }
    },
  });

  const allowedRootEntries = new Set(['dist', 'node_modules', 'package.json', 'uploads']);
  for (const entry of rootEntries) {
    if (!allowedRootEntries.has(entry)) violations.push(`${label}: forbidden application-root entry ${entry}`);
  }
  if (requireCompleteRoot) {
    if (!apiRootSeen) violations.push(`${label}: missing /app/apps/api`);
    for (const entry of allowedRootEntries) {
      if (!rootEntries.has(entry)) violations.push(`${label}: missing application-root entry ${entry}`);
    }
  }
}

function indexTar(filePath) {
  const entries = new Map();
  visitTar(filePath, {
    onEntry(entry) {
      if ((entry.type === '0' || entry.type === '7') && entry.name) entries.set(entry.name, entry);
    },
  });
  return entries;
}

function readIndexedEntry(filePath, entry, maximumSize = 64 * 1024 * 1024) {
  if (!entry || entry.size > maximumSize) throw new Error('missing or oversized image archive metadata');
  const fd = openSync(filePath, 'r');
  try {
    return readExactly(fd, entry.dataOffset, entry.size);
  } finally {
    closeSync(fd);
  }
}

function inspectImageConfig(inspect) {
  const config = inspect.Config || {};
  if (config.User !== 'api') violations.push('image config: runtime user is not api');
  if (config.WorkingDir !== '/app') violations.push('image config: working directory is not /app');
  if (JSON.stringify(config.Cmd) !== JSON.stringify(['node', 'apps/api/dist/main.js'])) {
    violations.push('image config: unexpected command');
  }
  if (!config.ExposedPorts?.['4000/tcp']) violations.push('image config: port 4000 is not exposed');
  if (!config.Healthcheck?.Test?.length) violations.push('image config: healthcheck is missing');

  const sensitiveName = /(?:^|_)(?:API_KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL|REDIS_URL|AUTHORIZATION)$/i;
  for (const item of config.Env || []) {
    const equals = item.indexOf('=');
    const name = equals === -1 ? item : item.slice(0, equals);
    const value = equals === -1 ? '' : item.slice(equals + 1);
    if (sensitiveName.test(name) && value.length > 0) {
      violations.push(`image config: embedded sensitive environment variable ${name}`);
    }
  }
  scanText(JSON.stringify(inspect), 'image-inspect/config-history');
}

async function scanSavedImage(imageArchive) {
  const entries = indexTar(imageArchive);
  const manifestEntry = entries.get('manifest.json');
  const manifestBuffer = readIndexedEntry(imageArchive, manifestEntry);
  scanText(manifestBuffer.toString('utf8'), 'archive/manifest.json');
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  if (!Array.isArray(manifest) || manifest.length !== 1) throw new Error('image archive contains an unexpected manifest');

  const configEntry = entries.get(normalizeTarPath(manifest[0].Config));
  const configBuffer = readIndexedEntry(imageArchive, configEntry);
  scanText(configBuffer.toString('utf8'), `archive/${basename(manifest[0].Config)}`);
  const repositoriesEntry = entries.get('repositories');
  if (repositoriesEntry) scanText(readIndexedEntry(imageArchive, repositoriesEntry).toString('utf8'), 'archive/repositories');

  for (const [index, layerName] of manifest[0].Layers.entries()) {
    const entry = entries.get(normalizeTarPath(layerName));
    if (!entry) throw new Error(`image archive layer ${index} is missing`);
    const fd = openSync(imageArchive, 'r');
    let magic;
    try {
      magic = readExactly(fd, entry.dataOffset, Math.min(2, entry.size));
    } finally {
      closeSync(fd);
    }

    scannedLayers += 1;
    if (magic[0] === 0x1f && magic[1] === 0x8b) {
      const uncompressedLayer = join(tempRoot, `layer-${index}.tar`);
      await pipeline(
        createReadStream(imageArchive, { start: entry.dataOffset, end: entry.dataOffset + entry.size - 1 }),
        createGunzip(),
        createWriteStream(uncompressedLayer),
      );
      scanTar(uncompressedLayer, { label: `layer-${index}` });
    } else {
      scanTar(imageArchive, {
        baseOffset: entry.dataOffset,
        byteLength: entry.size,
        label: `layer-${index}`,
      });
    }
  }
}

async function main() {
  const inspectResult = run('docker', ['image', 'inspect', image], 'image inspection');
  const inspected = JSON.parse(inspectResult.stdout);
  if (!Array.isArray(inspected) || inspected.length !== 1) throw new Error('image inspection returned an unexpected result');
  inspectImageConfig(inspected[0]);

  run('docker', ['create', '--name', containerName, '--entrypoint', '/bin/true', image], 'verification container creation');
  containerCreated = true;

  const finalArchive = join(tempRoot, 'finalfs.tar');
  run('docker', ['export', '--output', finalArchive, containerName], 'merged filesystem export');
  scanTar(finalArchive, { label: 'merged', requireCompleteRoot: true });

  const imageArchive = join(tempRoot, 'image.tar');
  run('docker', ['image', 'save', '--output', imageArchive, image], 'image archive export');
  await scanSavedImage(imageArchive);

  const uniqueViolations = [...new Set(violations)].sort();
  if (uniqueViolations.length > 0) {
    console.error(`API runtime image verification failed with ${uniqueViolations.length} violation(s):`);
    for (const violation of uniqueViolations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(`API runtime image verification passed: layers=${scannedLayers}, files=${scannedFiles}, violations=0`);
}

try {
  await main();
} catch (error) {
  console.error(`API runtime image verification failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  if (containerCreated) run('docker', ['rm', '-f', containerName], 'verification container cleanup', { allowFailure: true });
  rmSync(tempRoot, { recursive: true, force: true });
}
