import { extname } from 'path';

export type DocumentTitleSource = 'user' | 'metadata' | 'filename' | 'fallback';

export interface StoredDocumentTitle {
  documentTitle: string;
  documentTitleSource: DocumentTitleSource;
  titleConfirmed: boolean;
  originalFilename: string;
}

const MEANINGLESS_METADATA_TITLES = new Set([
  'untitled',
  'untitled document',
  'document',
  'microsoft word',
  'pdf',
  'scan',
  'unknown',
]);

function normalizeText(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

export function cleanFilenameTitle(originalName: string): string {
  const normalizedName = normalizeText(originalName).replace(/\\/g, '/').split('/').pop() ?? '';
  if (/^\.[a-z0-9]+$/i.test(normalizedName)) return '';
  const extension = extname(normalizedName);
  let title = extension ? normalizedName.slice(0, -extension.length) : normalizedName;
  try {
    title = decodeURIComponent(title);
  } catch {
    // Keep malformed percent-encoding as literal filename text.
  }
  return normalizeText(title)
    .replace(/^(?:www\.)?noor[-_. ]?book\.com(?:\s*[-_–—:|]+\s*)?/i, '')
    .replace(/^[\s._–—-]+|[\s._–—-]+$/g, '')
    .slice(0, 255);
}

export function validMetadataTitle(value: unknown): string | undefined {
  const title = normalizeText(value).slice(0, 255);
  if (!title || MEANINGLESS_METADATA_TITLES.has(title.toLocaleLowerCase('en-US'))) return undefined;
  return title;
}

export function createInitialDocumentTitle(
  originalFilename: string,
  requestedTitle?: string,
): StoredDocumentTitle {
  const userTitle = normalizeText(requestedTitle).slice(0, 255);
  if (userTitle) {
    return {
      documentTitle: userTitle,
      documentTitleSource: 'user',
      titleConfirmed: true,
      originalFilename,
    };
  }
  const filenameTitle = cleanFilenameTitle(originalFilename);
  return {
    documentTitle: filenameTitle || 'Untitled document',
    documentTitleSource: filenameTitle ? 'filename' : 'fallback',
    titleConfirmed: false,
    originalFilename,
  };
}

export function resolvePublishedDocumentTitle(
  existingMetadata: unknown,
  originalFilename: string,
  extractedTitle?: unknown,
): StoredDocumentTitle {
  const existing = existingMetadata && typeof existingMetadata === 'object'
    ? existingMetadata as Partial<StoredDocumentTitle>
    : {};
  const confirmedTitle = normalizeText(existing.documentTitle).slice(0, 255);
  if (existing.titleConfirmed && confirmedTitle) {
    return {
      documentTitle: confirmedTitle,
      documentTitleSource: 'user',
      titleConfirmed: true,
      originalFilename,
    };
  }
  const metadataTitle = validMetadataTitle(extractedTitle);
  if (metadataTitle) {
    return {
      documentTitle: metadataTitle,
      documentTitleSource: 'metadata',
      titleConfirmed: false,
      originalFilename,
    };
  }
  return createInitialDocumentTitle(originalFilename);
}

export function getStoredDocumentTitle(metadata: unknown, originalFilename: string): string {
  if (metadata && typeof metadata === 'object') {
    const title = validMetadataTitle((metadata as Partial<StoredDocumentTitle>).documentTitle);
    if (title) return title;
  }
  return createInitialDocumentTitle(originalFilename).documentTitle;
}
