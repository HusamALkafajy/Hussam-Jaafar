import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { inspectText, inspectFile, isReviewed, canonicalSourceSHA256 } from './check-no-committed-secrets.mjs';

test('detects independent generated literal signing keys without disclosing them', () => {
  const content = ['JWT_SECRET', 'JWT_REFRESH_SECRET']
    .map(key => key + '=' + randomBytes(48).toString('hex')).join('\n');
  assert.equal(inspectText(content).length, 2);
});
test('detects provider credentials, including OpenRouter', () => {
  const value = 'sk-' + 'or-v1-' + randomBytes(32).toString('hex');
  assert.ok(inspectText(value).length > 0);
});
test('detects raw JWT reports', () => {
  const value = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') +
    '.' + Buffer.from(JSON.stringify({ sub: 'inert-test-only' })).toString('base64url') +
    '.' + randomBytes(32).toString('base64url');
  assert.ok(inspectText(value).some(finding => finding.provider === 'JWT literal'));
});
test('detects private-key blocks without retaining private material', () => {
  const value = ['-----BEGIN ', 'PRIVATE KEY-----\n', randomBytes(32).toString('base64'),
    '\n-----END ', 'PRIVATE KEY-----'].join('');
  assert.ok(inspectText(value).some(finding => finding.provider === 'Private key material'));
});
test('detects credential-bearing database URLs', () => {
  const value = ['postgresql:', '//test-user:', randomBytes(24).toString('hex'), '@localhost/inert'].join('');
  assert.ok(inspectText(value).some(finding => finding.key === 'CONNECTION_URL_PASSWORD'));
});
test('environment references do not become literal credentials', () => {
  assert.equal(inspectText('JWT_SECRET=process.env.JWT_SECRET').length, 0);
});
test('new placeholder/test paths are not blanket-exempt', () => {
  const finding = inspectText('JWT_SECRET=<SET_JWT_SECRET>')[0];
  assert.ok(finding);
  assert.equal(isReviewed(finding, 'new-test.env', 'new-digest', { entries: [] }), false);
});
test('review rules fail closed on every identity/location change', () => {
  const finding = inspectText('JWT_SECRET=' + randomBytes(48).toString('hex'))[0];
  const row = { file: 'inert.ts', fileSHA256: 'digest', ...finding, reason: 'Individually reviewed inert fixture context only.' };
  const baseline = { entries: [row] };
  assert.equal(isReviewed(finding, 'inert.ts', 'digest', baseline), true);
  assert.equal(isReviewed(finding, 'other.ts', 'digest', baseline), false);
  assert.equal(isReviewed(finding, 'inert.ts', 'changed', baseline), false);
  for (const changed of [{ line: 2 }, { key: 'OTHER' }, { fingerprint: 'different' }]) {
    assert.equal(isReviewed({ ...finding, ...changed }, 'inert.ts', 'digest', baseline), false);
  }
});
test('source identities are portable across CRLF and LF only', () => {
  const lf = Buffer.from('const value = 1;\n');
  assert.equal(canonicalSourceSHA256(lf), canonicalSourceSHA256(Buffer.from('const value = 1;\r\n')));
  assert.notEqual(canonicalSourceSHA256(lf), canonicalSourceSHA256(Buffer.from('const value = 2;\n')));
});

const generatedPath = 'packages/infrastructure/src/prisma-client/package.json';
function generatedFixture() {
  // Deterministic, noncredential model text; find a fixture above the existing
  // entropy threshold so the positive test cannot pass vacuously.
  for (let i = 0; i < 100; i++) {
    const schema = 'model InertFixture {\n id Int @id\n}\n// fixture ' + i;
    const name = 'prisma-client-' + createHash('sha256').update(schema).digest('hex');
    const content = JSON.stringify({ name, version: '5.22.0' }, null, 2);
    if (inspectText(content).length) return { schema, name, content };
  }
  throw new Error('No meaningful entropy fixture');
}

test('only the schema-derived generated root name is adjudicated', () => {
  const f = generatedFixture();
  assert.ok(inspectText(f.content).some(x => x.key === 'HIGH_ENTROPY_QUOTED_LITERAL'));
  assert.equal(inspectFile(f.content, generatedPath, f.schema).length, 0);
  assert.equal(inspectFile(f.content.replace(/\n/g, '\r\n'), generatedPath, f.schema).length, 0);
  for (const file of ['src/ordinary.ts', 'package.json', generatedPath + '.bak'])
    assert.ok(inspectFile(f.content, file, f.schema).length > 0);
  assert.ok(inspectFile(f.content, generatedPath, f.schema + 'changed').length > 0);
  assert.ok(inspectFile(f.content, generatedPath).length > 0);
});

test('alternate properties and ambiguous JSON never inherit name adjudication', () => {
  const f = generatedFixture();
  assert.ok(inspectFile(JSON.stringify({ other: f.name }, null, 2), generatedPath, f.schema).length > 0);
  assert.ok(inspectFile(f.content.replace('"version"', '"name": "other",\n  "version"'), generatedPath, f.schema).length > 0);
  assert.ok(inspectFile(f.content.slice(0, -1), generatedPath, f.schema).length > 0);
});

test('bare 64-hex values remain detectable outside explained hash fields', () => {
  const value = randomBytes(32).toString('hex');
  for (const [content, file] of [
    ['const opaque = "' + value + '";', 'src/ordinary.ts'],
    [JSON.stringify({ other: value }, null, 2), 'package.json'],
    [JSON.stringify({ name: value }, null, 2), generatedPath],
  ]) assert.ok(inspectFile(content, file, 'inert').some(x => x.key === 'UNCLASSIFIED_HEX_LITERAL'));
});

test('generated package remains scanned for JWT, token and connection credentials', () => {
  const f = generatedFixture();
  const jwt = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' +
    Buffer.from(JSON.stringify({ sub: 'inert-only' })).toString('base64url') + '.' + randomBytes(32).toString('base64url');
  const cases = [
    ['other', jwt, 'JWT literal'],
    ['apiToken', randomBytes(32).toString('hex'), 'Named credential/secret'],
    ['other', 'sk-' + randomBytes(32).toString('base64url'), 'OpenAI/Anthropic API key'],
    ['DATABASE_URL', 'postgresql://fixture:' + randomBytes(24).toString('hex') + '@localhost/inert', 'Database/cache/queue password'],
  ];
  for (const [key, value, provider] of cases) {
    const content = JSON.stringify({ name: f.name, [key]: value }, null, 2);
    assert.ok(inspectFile(content, generatedPath, f.schema).some(x => x.provider === provider));
  }
});
