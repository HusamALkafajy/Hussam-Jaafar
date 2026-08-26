# Private Alpha PDF pipeline

StudyAI treats the original uploaded document and its extracted text as separate products.

## Storage and delivery

- Uploads receive an opaque, stable storage key in the configured `documents` bucket. The original filename, MIME type, and size remain database metadata.
- Local validation uses the persistent `STORAGE_PATH` volume. It is suitable for disposable/private-alpha validation only; a Supabase Storage adapter remains pending.
- `GET /api/files/:id/original` requires the existing JWT authentication and verifies file ownership before streaming an object. It accepts standard byte ranges for PDF.js and returns a sanitized inline filename.
- Storage keys, storage URLs, temporary paths, and raw processing errors are never returned in file DTOs.
- Deleting a file removes its storage object before removing its database record. Missing objects are handled safely on retry.

## Extraction and status

- Text-based PDFs are extracted deterministically with the existing server-side PDF.js extractor. Text is preserved by page and is used for summaries, explanations, quizzes, flashcards, chat, search, and RAG.
- A document becomes ready only when deterministic non-empty text has been published. Mock placeholder language is rejected from public responses and generated-learning inputs.
- Image-only/scanned PDFs remain available in **Original Document** mode but report an OCR-required extraction state. StudyAI does not fabricate text or claim that learning features ran on such a document.
- Mock document extraction is restricted to explicit automated-test configuration: `NODE_ENV=test` and `ALLOW_MOCK_DOCUMENT_EXTRACTION=true`.

## Workspace modes

- **Original Document** renders the protected PDF through an authenticated PDF.js request with continuous pages, fit-width, zoom, and page navigation.
- **Extracted Text** renders only deterministic extracted text. It is never labelled as the original document.
- Summary, Explanation, Quiz, Flashcards, and Tutor remain separate learning features and are enabled only after valid extracted text is available.

## PDF.js packaging

- API extraction uses the PDF.js 6 legacy server entry directly, with dynamic-code evaluation disabled. It does not configure or depend on a browser Worker.
- The Web build copies only the PDF.js browser runtime and minified Worker into the generated, ignored `public/vendor/pdfjs` directory. The reader loads those same-origin assets after browser mount, so PDF.js and its optional native Canvas dependency stay outside the Next.js bundle graph.
- `pnpm --filter @studyai/web run prepare:pdfjs` is deterministic and runs automatically before Web development and production builds. Generated vendor assets are never committed.

## Current limitations

- OCR for scanned/image-only PDFs is intentionally deferred.
- Supabase Storage is not connected in this task. A future adapter must implement the existing storage-provider contract without changing the file API or stored opaque keys.
