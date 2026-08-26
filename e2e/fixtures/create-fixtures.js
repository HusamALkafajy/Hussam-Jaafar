#!/usr/bin/env node
/**
 * Creates real PDF test fixtures for the E2E certification suite.
 * Run once: node e2e/fixtures/create-fixtures.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'files');
fs.mkdirSync(dir, { recursive: true });

// ── Real minimal PDF with extractable text ──────────────────────────────────
// This is a hand-crafted but structurally valid PDF-1.4 file.
// mammoth/AI extraction will parse this during processing.
const lines = [
  'BT',
  '/F1 14 Tf',
  '50 750 Td',
  '(StudyAI E2E Test Document) Tj',
  '0 -25 Td',
  '(Chapter 1: Introduction to Artificial Intelligence) Tj',
  '0 -20 Td',
  '(Artificial intelligence is the simulation of human intelligence by machines.) Tj',
  '0 -20 Td',
  '(Machine learning is a core subset of AI that enables systems to learn from data.) Tj',
  '0 -20 Td',
  '(Deep learning uses neural networks with many layers to model complex patterns.) Tj',
  '0 -20 Td',
  '(Supervised learning requires labelled training data.) Tj',
  '0 -25 Td',
  '(Chapter 2: Applications) Tj',
  '0 -20 Td',
  '(AI is used in healthcare, finance, education, and autonomous vehicles.) Tj',
  'ET',
];
const streamContent = lines.join('\n');
const streamLength = Buffer.byteLength(streamContent, 'utf8');

const pdfLines = [
  '%PDF-1.4',
  '1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj',
  '2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj',
  `3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<</Font<</F1 5 0 R>>>>>>endobj`,
  `4 0 obj<</Length ${streamLength}>>`,
  'stream',
  streamContent,
  'endstream',
  'endobj',
  '5 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj',
  'xref',
  '0 6',
  '0000000000 65535 f ',
  '0000000009 00000 n ',
  '0000000058 00000 n ',
  '0000000115 00000 n ',
  '0000000274 00000 n ',
  '0000000550 00000 n ',
  'trailer<</Size 6 /Root 1 0 R>>',
  'startxref',
  '640',
  '%%EOF',
];

fs.writeFileSync(path.join(dir, 'sample.pdf'), pdfLines.join('\n'));
console.log('Created sample.pdf');

// ── Corrupted PDF ─────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(dir, 'corrupted.pdf'),
  'This file has a PDF extension but is not a valid PDF document. Corrupted content.'
);
console.log('Created corrupted.pdf');

// ── Unsupported file type ─────────────────────────────────────────────────
fs.writeFileSync(
  path.join(dir, 'unsupported.txt'),
  'Plain text files are not supported by StudyAI.'
);
console.log('Created unsupported.txt');

// ── Large file placeholder (5MB of repeated content) ─────────────────────
// This tests size validation. We create it only if needed (expensive).
const largePath = path.join(dir, 'large.pdf');
if (!fs.existsSync(largePath)) {
  const chunk = Buffer.alloc(1024 * 512, 'X'); // 512KB chunks
  const fd = fs.openSync(largePath, 'w');
  for (let i = 0; i < 120; i++) { // ~60MB
    fs.writeSync(fd, chunk);
  }
  fs.closeSync(fd);
  console.log('Created large.pdf (~60MB)');
}

console.log('\nAll fixtures created in:', dir);
