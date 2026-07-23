import * as fs from 'fs';
import { StructuralBlock } from '@studyai/ast';
import {
  DocumentExtractor,
  DocumentExtractionContext,
  EmptyDocumentError,
  MissingTextLayerError,
  EncryptedDocumentError,
  MalformedDocumentError,
  ExtractionResourceLimitError
} from '../../contracts/document-extractor';
import { ExtractedDocument } from '../../contracts/extracted-document';
import { ExtractedDocumentFactory } from './extracted-document.factory';

// Suppress standard font warnings for Node.js usage.
// pdfjs-dist's legacy build is safest for CommonJS Node environments.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

export class NativePdfExtractor implements DocumentExtractor {
  async extract(context: DocumentExtractionContext): Promise<ExtractedDocument> {
    if (!context.filePath) {
      throw new MalformedDocumentError('PDF extraction requires a valid file path.');
    }

    let rawData: Buffer;
    try {
      rawData = await fs.promises.readFile(context.filePath);
    } catch (error: any) {
      throw new MalformedDocumentError(`Failed to read PDF file: ${error.message}`);
    }

    let doc: pdfjsLib.PDFDocumentProxy;
    try {
      // Use standard Node.js entry point, parsing from byte array
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(rawData),
        useSystemFonts: true,
      });

      const abortHandler = () => {
        try {
          loadingTask.destroy();
        } catch (e) {
          // ignore destroy errors
        }
      };

      if (context.signal) {
        if (context.signal.aborted) {
          abortHandler();
        } else {
          context.signal.addEventListener('abort', abortHandler, { once: true });
        }
      }

      doc = await loadingTask.promise;
      
      if (context.signal) {
        context.signal.removeEventListener('abort', abortHandler);
      }
    } catch (error: any) {
      if (error.name === 'PasswordException') {
        throw new EncryptedDocumentError('The PDF is encrypted and requires a password.');
      }
      
      if (context.signal?.aborted || error.message === 'Loading aborted') {
        // We do not throw ExtractionTimeoutError here. The caller (FilesProcessor) 
        // that initiated the abort will catch its own AbortError/TimeoutError.
        // We just bubble up a generic or abort error, which will be intercepted by the orchestrator.
        throw error;
      }
      
      console.error('PDF Parse Error:', error);
      throw new MalformedDocumentError(`Failed to parse PDF document: ${error.message}`);
    }

    const numPages = doc.numPages;
    if (numPages === 0) {
      throw new EmptyDocumentError('The PDF document contains 0 pages.');
    }

    // Safety bound to prevent OOM
    const MAX_EXTRACTION_PAGES = 2000;
    if (numPages > MAX_EXTRACTION_PAGES) {
      throw new ExtractionResourceLimitError(`Document exceeds maximum allowed extraction page limit (${MAX_EXTRACTION_PAGES}).`);
    }

    const blocks: StructuralBlock[] = [];
    let totalTextItems = 0;
    let hasVisualContent = false;

    for (let i = 1; i <= numPages; i++) {
      let page: pdfjsLib.PDFPageProxy;
      try {
        page = await doc.getPage(i);
      } catch (error: any) {
        throw new MalformedDocumentError(`Failed to get page ${i}: ${error.message}`);
      }

      let textContent: import('pdfjs-dist/types/src/display/api').TextContent;
      try {
        textContent = await page.getTextContent();
      } catch (error: any) {
        throw new MalformedDocumentError(`Failed to extract text from page ${i}: ${error.message}`);
      }

      if (textContent.items.length > 0) {
        totalTextItems += textContent.items.length;

        // Aggregate all text items on the page into a single paragraph block
        const pageStrings = textContent.items
          // `item` could be TextItem or TextMarkedContent; we assume `str` is on TextItem
          .map((item: any) => item.str || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (pageStrings.length > 0) {
          blocks.push({
            type: 'paragraph',
            text: pageStrings,
            metadata: {
              sourcePage: i
            }
          });
        }
      } else {
        // If no text items on this page, heuristically check for visual content
        if (!hasVisualContent) {
          try {
            const opList = await page.getOperatorList();
            hasVisualContent = opList.fnArray.some((op: number) =>
              op === pdfjsLib.OPS.paintImageXObject ||
              op === pdfjsLib.OPS.paintXObject ||
              op === pdfjsLib.OPS.paintInlineImageXObject ||
              op === pdfjsLib.OPS.paintFormXObjectBegin ||
              op === pdfjsLib.OPS.fill ||
              op === pdfjsLib.OPS.stroke ||
              op === pdfjsLib.OPS.eoFill ||
              op === pdfjsLib.OPS.paintSolidColorImageMask
            );
          } catch (e) {
            // Ignore operator list failure; default to false if unsure
          }
        }
      }
    }

    if (totalTextItems === 0) {
      if (hasVisualContent) {
        throw new MissingTextLayerError('No text items found, but visual content detected. Document requires OCR.');
      } else {
        throw new EmptyDocumentError('No text items or visual content found in PDF.');
      }
    }

    if (blocks.length === 0) {
      throw new EmptyDocumentError('PDF text extraction yielded no usable text.');
    }

    return ExtractedDocumentFactory.fromBlocks(blocks);
  }
}
