import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  parseTrackedEntries,
  scanRepository,
} from './check-no-committed-secrets.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const guardPath = path.join(scriptDirectory, 'check-no-committed-secrets.mjs');
const syntheticCredentialUri = [
  'postgresql://synthetic_user',
  ':synthetic_password',
  '@example.invalid:5432/synthetic_database',
].join('');

function withRepository(files, callback) {
  const repository = mkdtempSync(path.join(os.tmpdir(), 'studyai-secret-guard-'));

  try {
    execFileSync('git', ['init', '--quiet'], { cwd: repository });
    execFileSync('git', ['config', 'user.email', 'guard@example.invalid'], { cwd: repository });
    execFileSync('git', ['config', 'user.name', 'StudyAI Guard Test'], { cwd: repository });

    for (const [relativePath, contents] of Object.entries(files)) {
      const absolutePath = path.join(repository, ...relativePath.split('/'));
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, contents);
    }

    execFileSync('git', ['add', '--', ...Object.keys(files)], { cwd: repository });
    return callback(repository);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
}

function runGuard(repository) {
  return spawnSync(process.execPath, [guardPath], {
    cwd: repository,
    encoding: 'utf8',
  });
}

function assertRejected(files, category) {
  withRepository(files, repository => {
    const result = runGuard(repository);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(category));
    assert.doesNotMatch(result.stderr, /synthetic_password/);
    assert.doesNotMatch(result.stdout, /synthetic_password/);
  });
}

function utf16BigEndian(text) {
  const littleEndian = Buffer.from(text, 'utf16le');
  const bigEndian = Buffer.alloc(littleEndian.length + 2);
  bigEndian[0] = 0xfe;
  bigEndian[1] = 0xff;
  for (let index = 0; index < littleEndian.length; index += 2) {
    bigEndian[index + 2] = littleEndian[index + 1];
    bigEndian[index + 3] = littleEndian[index];
  }
  return bigEndian;
}

test('parses NUL-delimited index entries without path ambiguity', () => {
  const hash = 'a'.repeat(40);
  const buffer = Buffer.from(
    `100644 ${hash} 0\tspace name.txt\0` +
    `100644 ${hash} 0\tline\nbreak.txt\0` +
    `100644 ${hash} 0\tلغة.txt\0`,
  );

  assert.deepEqual(
    parseTrackedEntries(buffer).map(entry => entry.file),
    ['space name.txt', 'line\nbreak.txt', 'لغة.txt'],
  );
});

test('rejects a UTF-8 credential in an unexpected extension', () => {
  assertRejected({ 'payload.custom': syntheticCredentialUri }, 'credential-bearing URI');
});

test('rejects a UTF-16LE credential', () => {
  const contents = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(syntheticCredentialUri, 'utf16le'),
  ]);
  assertRejected({ 'encoded.data': contents }, 'credential-bearing URI');
});

test('rejects a UTF-16BE credential', () => {
  assertRejected({ 'encoded.data': utf16BigEndian(syntheticCredentialUri) }, 'credential-bearing URI');
});

test('scans extensionless text files', () => {
  assertRejected({ 'credentials': syntheticCredentialUri }, 'credential-bearing URI');
});

test('rejects the exact forbidden root residue path', () => {
  assertRejected({ 'patch.tmp': 'safe content' }, 'forbidden tracked root residue');
});

test('does not reject an unrelated nested temporary filename', () => {
  withRepository({ 'nested/patch.tmp': 'safe content' }, repository => {
    const result = scanRepository(repository);
    assert.deepEqual(result.findings, []);
  });
});

test('skips genuine binary data even when it contains printable URI fragments', () => {
  const contents = Buffer.concat([
    Buffer.from([0, 1, 2, 3, 4, 5]),
    Buffer.from(syntheticCredentialUri),
    Buffer.from([0, 255, 0, 254]),
  ]);

  withRepository({ 'asset.bin': contents }, repository => {
    const result = scanRepository(repository);
    assert.deepEqual(result.findings, []);
    assert.equal(result.skippedBinaryFiles, 1);
  });
});

test('fails closed for malformed UTF-16 text', () => {
  assertRejected(
    { 'malformed.data': Buffer.from([0xff, 0xfe, 0x41]) },
    'cannot be decoded safely',
  );
});

test('accepts environment references for sensitive configuration', () => {
  withRepository({
    '.env.example': [
      'DATABASE_URL=${DATABASE_URL}',
      'JWT_SECRET=${JWT_SECRET}',
      'api_key: process.env.API_KEY',
      'password: ${{ secrets.CI_PASSWORD }}',
    ].join('\n'),
  }, repository => {
    const result = scanRepository(repository);
    assert.deepEqual(result.findings, []);
  });
});

test('accepts an explicit synthetic loopback placeholder credential', () => {
  const localPlaceholder = ['postgresql://postgres', ':postgres', '@localhost:5432/test'].join('');
  withRepository({ 'local-example.conf': localPlaceholder }, repository => {
    const result = scanRepository(repository);
    assert.deepEqual(result.findings, []);
  });
});

test('handles spaces and non-ASCII tracked filenames', () => {
  withRepository({
    'space name.txt': 'safe content',
    'ملف آمن.txt': 'safe content',
  }, repository => {
    const result = scanRepository(repository);
    assert.deepEqual(result.findings, []);
    assert.equal(result.scannedTextFiles, 2);
  });
});

test('the StudyAI repository passes its hardened guard', () => {
  const repositoryRoot = path.resolve(scriptDirectory, '..');
  const result = scanRepository(repositoryRoot);
  assert.deepEqual(result.findings, []);
});
