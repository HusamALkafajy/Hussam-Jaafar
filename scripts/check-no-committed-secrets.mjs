import { execFileSync } from "node:child_process";
import {
  closeSync,
  lstatSync,
  openSync,
  readFileSync,
  readSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

const MAX_TEXT_BYTES = 16 * 1024 * 1024;
const SAMPLE_BYTES = 64 * 1024;
const MAX_REPORTED_FINDINGS = 100;
const FORBIDDEN_TRACKED_ROOT_PATHS = new Set(["patch.tmp"]);
// This deterministic 60 MiB oversized-upload fixture contains only filler bytes.
// Pinning its Git object ID prevents a changed file from inheriting the exception.
const EXPLICIT_BINARY_FIXTURES = new Map([
  ["e2e/fixtures/files/large.pdf", "aa32a66edaa0a1b6d859b000807006a26f2206f6"],
]);

const textExtensions = new Set([
  ".cjs",
  ".conf",
  ".css",
  ".env",
  ".html",
  ".ini",
  ".js",
  ".json",
  ".mjs",
  ".md",
  ".ps1",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const credentialUriPattern =
  /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|https?):\/\/([^/\s:@]+):([^@\s/]+)@(\[[^\]]+\]|[^/\s:?#]+)/gi;
const privateKeyPattern = /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/g;
const providerKeyPatterns = [
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+\b/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
];
const sensitiveNamePattern =
  /(?:password|passwd|secret|api[_-]?key|apikey|private[_-]?key|access[_-]?key|database[_-]?url|databaseurl|redis[_-]?url|redisurl|connection[_-]?string)/i;
const assignmentPattern =
  /^\s*(?:export\s+)?["']?([A-Za-z][A-Za-z0-9_.-]*)["']?\s*[:=]\s*(.*?)\s*$/;

function normalizeGitPath(file) {
  return file.replaceAll("\\", "/");
}

function isKnownTextFile(file) {
  const baseName = path.basename(file);
  return (
    textExtensions.has(path.extname(file).toLowerCase()) ||
    baseName.startsWith(".env") ||
    baseName === "Dockerfile" ||
    baseName.startsWith("docker-compose")
  );
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function isEnvironmentReference(value) {
  const normalized = value
    .replace(/(?:,|;)\s*$/, "")
    .replace(/\s*#.*$/, "")
    .trim();

  return (
    normalized === "" ||
    normalized === "undefined" ||
    /^\$\{[A-Za-z_][A-Za-z0-9_]*(?::[-?][^}]*)?\}$/.test(normalized) ||
    /^\$\{\{[\s\S]+\}\}$/.test(normalized) ||
    /^process\.env\.[A-Za-z_][A-Za-z0-9_]*$/.test(normalized) ||
    /^\$env:[A-Za-z_][A-Za-z0-9_]*$/i.test(normalized)
  );
}

function isSensitiveKey(file, key) {
  if (!sensitiveNamePattern.test(key)) {
    return false;
  }

  if (
    /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(key) &&
    key !== "api-key" &&
    key !== "private-key"
  ) {
    return false;
  }

  return !(
    /passwordhash|passwordfield|displayname$/i.test(key) ||
    file.includes("/i18n/")
  );
}

function isSafeSensitiveAssignment(file, key, value) {
  const normalized = value
    .replace(/(?:,|;)\s*$/, "")
    .replace(/\s*#.*$/, "")
    .trim();

  if (isEnvironmentReference(normalized)) {
    return true;
  }

  if (
    /^(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp):\/\/(?![^/\s:@]+:[^@\s/]+@)/i.test(
      normalized,
    )
  ) {
    return true;
  }

  if (
    /^(?:\{|\[|z\.|Joi\.|typeof\b|String\b|Boolean\b|number\b|unknown\b|true\b|false\b|null\b)/.test(
      normalized,
    )
  ) {
    return true;
  }

  const extension = path.extname(file).toLowerCase();
  const configurationLikeFile =
    [
      ".env",
      ".example",
      ".ini",
      ".json",
      ".md",
      ".toml",
      ".yaml",
      ".yml",
    ].includes(extension) || path.basename(file).startsWith("docker-compose");

  if (/^["'`]/.test(normalized) || configurationLikeFile) {
    return false;
  }

  return true;
}

function isDemonstrablySyntheticLoopbackUri(match) {
  const username = match[1];
  const password = match[2];
  const hostname = match[3].replace(/^\[|\]$/g, "");
  const loopback = /^(?:localhost|127\.0\.0\.1|::1)$/i.test(hostname);
  const commonPlaceholder =
    /^(?:password|postgres|test|example|changeme|dummy)$/i.test(password);
  return loopback && commonPlaceholder && username === password;
}

function inspectText(file, content) {
  const findings = [];
  const patterns = [
    ["credential-bearing URI", credentialUriPattern],
    ["private key block", privateKeyPattern],
    ...providerKeyPatterns.map((pattern) => [
      "provider key signature",
      pattern,
    ]),
  ];

  for (const [category, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      if (
        category === "credential-bearing URI" &&
        isDemonstrablySyntheticLoopbackUri(match)
      ) {
        continue;
      }
      findings.push({
        file,
        line: lineNumberAt(content, match.index),
        category,
      });
    }
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(assignmentPattern);
    if (!match || !isSensitiveKey(file, match[1])) {
      return;
    }

    if (!isSafeSensitiveAssignment(file, match[1], match[2])) {
      findings.push({
        file,
        line: index + 1,
        category: "literal sensitive assignment",
      });
    }
  });

  return findings;
}

function parseTrackedEntries(buffer) {
  const entries = [];

  for (const record of buffer.toString("utf8").split("\0")) {
    if (record === "") {
      continue;
    }

    const separator = record.indexOf("\t");
    const metadata = separator === -1 ? "" : record.slice(0, separator);
    const file = separator === -1 ? "" : record.slice(separator + 1);
    const match = metadata.match(/^([0-7]{6}) ([0-9a-f]{40,64}) ([0-3])$/);

    if (!match || file === "") {
      throw new Error("Unable to parse a tracked Git index entry.");
    }

    entries.push({
      mode: match[1],
      objectId: match[2],
      stage: Number(match[3]),
      file: normalizeGitPath(file),
    });
  }

  return entries;
}

function readSample(file, size) {
  const descriptor = openSync(file, "r");

  try {
    const sample = Buffer.alloc(Math.min(size, SAMPLE_BYTES));
    const bytesRead = readSync(descriptor, sample, 0, sample.length, 0);
    return sample.subarray(0, bytesRead);
  } finally {
    closeSync(descriptor);
  }
}

function looksLikeBomlessUtf16(sample) {
  if (sample.length < 8) {
    return false;
  }

  let evenNuls = 0;
  let oddNuls = 0;
  let evenPrintable = 0;
  let oddPrintable = 0;
  let evenCount = 0;
  let oddCount = 0;

  for (let index = 0; index < sample.length; index += 1) {
    const byte = sample[index];
    const printable =
      byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126);

    if (index % 2 === 0) {
      evenCount += 1;
      evenNuls += Number(byte === 0);
      evenPrintable += Number(printable);
    } else {
      oddCount += 1;
      oddNuls += Number(byte === 0);
      oddPrintable += Number(printable);
    }
  }

  const littleEndianShape =
    oddNuls / oddCount > 0.3 && evenPrintable / evenCount > 0.6;
  const bigEndianShape =
    evenNuls / evenCount > 0.3 && oddPrintable / oddCount > 0.6;
  return littleEndianShape || bigEndianShape;
}

function classifyBytes(sample, knownText) {
  const knownBinarySignatures = [
    Buffer.from("%PDF-"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.from("GIF87a"),
    Buffer.from("GIF89a"),
    Buffer.from("PK\x03\x04", "binary"),
  ];
  if (
    knownBinarySignatures.some(
      (signature) =>
        sample.length >= signature.length &&
        sample.subarray(0, signature.length).equals(signature),
    )
  ) {
    return { kind: "binary" };
  }

  if (sample.length >= 2 && sample[0] === 0xff && sample[1] === 0xfe) {
    return { kind: "text", encoding: "utf16le", bomBytes: 2 };
  }

  if (sample.length >= 2 && sample[0] === 0xfe && sample[1] === 0xff) {
    return { kind: "text", encoding: "utf16be", bomBytes: 2 };
  }

  if (
    sample.length >= 3 &&
    sample[0] === 0xef &&
    sample[1] === 0xbb &&
    sample[2] === 0xbf
  ) {
    return { kind: "text", encoding: "utf8", bomBytes: 3 };
  }

  if (looksLikeBomlessUtf16(sample)) {
    return { kind: "ambiguous", reason: "BOM-less UTF-16-like byte pattern" };
  }

  let nulCount = 0;
  let controlCount = 0;
  for (const byte of sample) {
    nulCount += Number(byte === 0);
    controlCount += Number(byte < 9 || (byte > 13 && byte < 32));
  }

  if (
    nulCount > 0 ||
    (sample.length > 0 && controlCount / sample.length > 0.1)
  ) {
    return knownText
      ? { kind: "ambiguous", reason: "binary bytes in a known text path" }
      : { kind: "binary" };
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
    return { kind: "text", encoding: "utf8", bomBytes: 0 };
  } catch {
    return knownText
      ? { kind: "ambiguous", reason: "invalid UTF-8 in a known text path" }
      : { kind: "binary" };
  }
}

function decodeTrackedText(bytes, classification) {
  const payload = bytes.subarray(classification.bomBytes);

  if (classification.encoding === "utf16le") {
    if (payload.length % 2 !== 0) {
      throw new Error("malformed UTF-16LE byte length");
    }
    return new TextDecoder("utf-16le", { fatal: true }).decode(payload);
  }

  if (classification.encoding === "utf16be") {
    if (payload.length % 2 !== 0) {
      throw new Error("malformed UTF-16BE byte length");
    }
    const littleEndian = Buffer.alloc(payload.length);
    for (let index = 0; index < payload.length; index += 2) {
      littleEndian[index] = payload[index + 1];
      littleEndian[index + 1] = payload[index];
    }
    return new TextDecoder("utf-16le", { fatal: true }).decode(littleEndian);
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(payload);
}

function isWithinRepository(repositoryRoot, candidate) {
  const relative = path.relative(repositoryRoot, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function scanRepository(repositoryRoot = process.cwd()) {
  const root = path.resolve(repositoryRoot);
  const rawEntries = execFileSync("git", ["ls-files", "--stage", "-z"], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  const entries = parseTrackedEntries(rawEntries);
  const findings = [];
  let scannedTextFiles = 0;
  let skippedBinaryFiles = 0;

  for (const entry of entries) {
    if (entry.stage !== 0) {
      findings.push({
        file: entry.file,
        line: 0,
        category: "unmerged tracked entry",
      });
      continue;
    }

    if (!entry.mode.startsWith("100")) {
      continue;
    }

    if (FORBIDDEN_TRACKED_ROOT_PATHS.has(entry.file)) {
      findings.push({
        file: entry.file,
        line: 0,
        category: "forbidden tracked root residue",
      });
      continue;
    }

    if (EXPLICIT_BINARY_FIXTURES.get(entry.file) === entry.objectId) {
      skippedBinaryFiles += 1;
      continue;
    }

    const absoluteFile = path.resolve(root, ...entry.file.split("/"));
    if (!isWithinRepository(root, absoluteFile)) {
      findings.push({
        file: entry.file,
        line: 0,
        category: "tracked path escapes repository root",
      });
      continue;
    }

    let stats;
    try {
      stats = lstatSync(absoluteFile);
    } catch {
      findings.push({
        file: entry.file,
        line: 0,
        category: "tracked file is unreadable",
      });
      continue;
    }

    if (!stats.isFile()) {
      findings.push({
        file: entry.file,
        line: 0,
        category: "tracked regular-file mode is not a regular file",
      });
      continue;
    }

    let classification;
    try {
      classification = classifyBytes(
        readSample(absoluteFile, stats.size),
        isKnownTextFile(entry.file),
      );
    } catch {
      findings.push({
        file: entry.file,
        line: 0,
        category: "tracked file sample is unreadable",
      });
      continue;
    }

    if (classification.kind === "binary") {
      skippedBinaryFiles += 1;
      continue;
    }

    if (classification.kind === "ambiguous") {
      findings.push({
        file: entry.file,
        line: 0,
        category: `ambiguous text encoding: ${classification.reason}`,
      });
      continue;
    }

    if (stats.size > MAX_TEXT_BYTES) {
      findings.push({
        file: entry.file,
        line: 0,
        category: "tracked text file exceeds scan size limit",
      });
      continue;
    }

    try {
      const content = decodeTrackedText(
        readFileSync(absoluteFile),
        classification,
      );
      scannedTextFiles += 1;
      findings.push(...inspectText(entry.file, content));
    } catch {
      findings.push({
        file: entry.file,
        line: 0,
        category: "tracked text file cannot be decoded safely",
      });
    }
  }

  return {
    findings,
    trackedEntries: entries.length,
    scannedTextFiles,
    skippedBinaryFiles,
  };
}

function runCli(repositoryRoot = process.cwd()) {
  let result;
  try {
    result = scanRepository(repositoryRoot);
  } catch {
    console.error(
      "Committed-secret guard failed closed while enumerating tracked files.",
    );
    return 1;
  }

  if (result.findings.length > 0) {
    console.error(
      "Committed-secret guard failed. Values are intentionally not printed.",
    );
    for (const finding of result.findings.slice(0, MAX_REPORTED_FINDINGS)) {
      const location = finding.line > 0 ? `:${finding.line}` : "";
      console.error(
        `${JSON.stringify(finding.file)}${location} [${finding.category}]`,
      );
    }
    if (result.findings.length > MAX_REPORTED_FINDINGS) {
      console.error(
        `Additional findings suppressed: ${result.findings.length - MAX_REPORTED_FINDINGS}`,
      );
    }
    return 1;
  }

  console.log(
    `Committed-secret guard passed for ${result.scannedTextFiles} tracked text files; ` +
      `${result.skippedBinaryFiles} binary files skipped.`,
  );
  return 0;
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  process.exitCode = runCli();
}

export { parseTrackedEntries, runCli, scanRepository };
