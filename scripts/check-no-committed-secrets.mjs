import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const textExtensions = new Set([
  '.cjs', '.conf', '.css', '.env', '.html', '.ini', '.js', '.json', '.mjs',
  '.md', '.ps1', '.sh', '.sql', '.toml', '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);

const credentialUriPattern = /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|https?):\/\/[^/\s:@]+:[^@\s/]+@/gi;
const privateKeyPattern = /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/g;
const providerKeyPatterns = [
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+\b/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
];
const sensitiveNamePattern = /(?:password|passwd|secret|api[_-]?key|apikey|private[_-]?key|access[_-]?key|database[_-]?url|databaseurl|redis[_-]?url|redisurl|connection[_-]?string)/i;
const assignmentPattern = /^\s*(?:export\s+)?["']?([A-Za-z][A-Za-z0-9_.-]*)["']?\s*[:=]\s*(.*?)\s*$/;

function isTextFile(file) {
  const baseName = path.basename(file);
  return textExtensions.has(path.extname(file).toLowerCase()) ||
    baseName.startsWith('.env') ||
    baseName === 'Dockerfile' ||
    baseName.startsWith('docker-compose');
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function isEnvironmentReference(value) {
  const normalized = value
    .replace(/(?:,|;)\s*$/, '')
    .replace(/\s*#.*$/, '')
    .trim();

  return normalized === '' ||
    normalized === 'undefined' ||
    /^\$\{[A-Za-z_][A-Za-z0-9_]*(?::[-?][^}]*)?\}$/.test(normalized) ||
    /^process\.env\.[A-Za-z_][A-Za-z0-9_]*$/.test(normalized) ||
    /^\$env:[A-Za-z_][A-Za-z0-9_]*$/i.test(normalized);
}

function isSensitiveKey(file, key) {
  if (!sensitiveNamePattern.test(key)) {
    return false;
  }

  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(key) && key !== 'api-key' && key !== 'private-key') {
    return false;
  }

  return !(/passwordhash|passwordfield|displayname$/i.test(key) || file.includes('/i18n/'));
}

function isSafeSensitiveAssignment(file, key, value) {
  const normalized = value
    .replace(/(?:,|;)\s*$/, '')
    .replace(/\s*#.*$/, '')
    .trim();

  if (isEnvironmentReference(normalized)) {
    return true;
  }

  if (/^(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp):\/\/(?![^/\s:@]+:[^@\s/]+@)/i.test(normalized)) {
    return true;
  }

  if (/^(?:\{|\[|z\.|Joi\.|typeof\b|String\b|Boolean\b|number\b|unknown\b|true\b|false\b|null\b)/.test(normalized)) {
    return true;
  }

  const extension = path.extname(file).toLowerCase();
  const configurationLikeFile = ['.env', '.example', '.ini', '.json', '.md', '.toml', '.yaml', '.yml'].includes(extension) ||
    path.basename(file).startsWith('docker-compose');

  if (/^["'`]/.test(normalized) || configurationLikeFile) {
    return false;
  }

  return true;
}

function inspectFile(file) {
  const content = readFileSync(file, 'utf8');
  const findings = [];
  const patterns = [
    ['credential-bearing URI', credentialUriPattern],
    ['private key block', privateKeyPattern],
    ...providerKeyPatterns.map(pattern => ['provider key signature', pattern]),
  ];

  for (const [category, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      findings.push({ file, line: lineNumberAt(content, match.index), category });
    }
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(assignmentPattern);
    if (!match || !isSensitiveKey(file, match[1])) {
      return;
    }

    if (!isSafeSensitiveAssignment(file, match[1], match[2])) {
      findings.push({ file, line: index + 1, category: 'literal sensitive assignment' });
    }
  });

  return findings;
}

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(isTextFile);

const findings = trackedFiles.flatMap(inspectFile);

if (findings.length > 0) {
  console.error('Committed-secret guard failed. Values are intentionally not printed.');
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} [${finding.category}]`);
  }
  process.exitCode = 1;
} else {
  console.log(`Committed-secret guard passed for ${trackedFiles.length} tracked text files.`);
}
