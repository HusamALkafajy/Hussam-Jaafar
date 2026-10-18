import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { inspectText, isReviewed, canonicalSourceSHA256 } from './check-no-committed-secrets.mjs';

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
