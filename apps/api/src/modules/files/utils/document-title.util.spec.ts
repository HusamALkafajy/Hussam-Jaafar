import {
  cleanFilenameTitle,
  createInitialDocumentTitle,
  resolvePublishedDocumentTitle,
  validMetadataTitle,
} from './document-title.util';

describe('document title semantics', () => {
  it('uses a confirmed user title before metadata and preserves Arabic', () => {
    const initial = createInitialDocumentTitle('Noor-Book.com-wrong.pdf', '  كتاب الفيزياء الحديث  ');
    expect(initial).toMatchObject({
      documentTitle: 'كتاب الفيزياء الحديث',
      documentTitleSource: 'user',
      titleConfirmed: true,
    });
    expect(resolvePublishedDocumentTitle(initial, initial.originalFilename, 'Extracted title'))
      .toMatchObject({ documentTitle: 'كتاب الفيزياء الحديث', documentTitleSource: 'user' });
  });

  it('promotes valid extracted metadata when no user title was confirmed', () => {
    const initial = createInitialDocumentTitle('downloaded-copy.pdf');
    expect(resolvePublishedDocumentTitle(initial, 'downloaded-copy.pdf', 'Linear Algebra'))
      .toMatchObject({ documentTitle: 'Linear Algebra', documentTitleSource: 'metadata' });
  });

  it('rejects generic metadata and cleans the distribution filename prefix', () => {
    expect(validMetadataTitle('Untitled')).toBeUndefined();
    expect(cleanFilenameTitle('Noor-Book.com--مبادئ_الجبر.pdf')).toBe('مبادئ_الجبر');
    expect(resolvePublishedDocumentTitle({}, 'Noor-Book.com--مبادئ_الجبر.pdf', 'Document'))
      .toMatchObject({ documentTitle: 'مبادئ_الجبر', documentTitleSource: 'filename' });
  });

  it('falls back without altering subject data', () => {
    const metadata = { subjectId: 'subject-kept' };
    const title = resolvePublishedDocumentTitle(metadata, '.pdf');
    expect(title.documentTitle).toBe('Untitled document');
    expect(metadata.subjectId).toBe('subject-kept');
  });
});
