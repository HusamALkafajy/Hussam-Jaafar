import * as fs from 'fs';
import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';

import {
  DocumentExtractor,
  DocumentExtractionContext,
  EmptyDocumentError,
  MalformedDocumentError,
  ExtractionResourceLimitError
} from '../../contracts/document-extractor';
import { ExtractedDocument } from '../../contracts/extracted-document';
import { ExtractedDocumentFactory } from './extracted-document.factory';
import { HtmlAstBuilder } from './html-mapper/html-ast.builder';
import { HtmlAstVisitor } from './html-mapper/html-ast.visitor';
import { CheerioHtmlNode } from './html-mapper/cheerio-html-node';
import { extractDocxTitle } from '../../utils/docx-title.util';

export class MammothDocxExtractor implements DocumentExtractor {
  async extract(context: DocumentExtractionContext): Promise<ExtractedDocument> {
    if (!context.filePath) {
      throw new MalformedDocumentError('DOCX extraction requires a valid file path.');
    }

    let rawData: Buffer;
    try {
      rawData = await fs.promises.readFile(context.filePath);
    } catch (error: any) {
      throw new MalformedDocumentError(`Failed to read DOCX file: ${error.message}`);
    }

    // Check strict size limits before parsing
    const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
    if (rawData.length > MAX_SIZE_BYTES) {
      throw new ExtractionResourceLimitError(`Document exceeds maximum allowed extraction file size (${MAX_SIZE_BYTES} bytes).`);
    }

    // We can't trivially map AbortSignal to a synchronous Mammoth parsing call because Mammoth is atomic.
    // However, Mammoth is extremely fast. We can check the signal right before and right after.
    if (context.signal?.aborted) {
      throw new ExtractionResourceLimitError('Extraction aborted due to timeout.');
    }

    let result: any;
    try {
      result = await mammoth.convertToHtml({ buffer: rawData });
    } catch (error: any) {
      throw new MalformedDocumentError(`Failed to parse DOCX document: ${error.message}`);
    }

    if (context.signal?.aborted) {
      throw new ExtractionResourceLimitError('Extraction aborted due to timeout.');
    }

    const html = result.value;

    if (!html.trim()) {
      throw new EmptyDocumentError('The DOCX document contains no extractable text.');
    }

    // Initialize the mapping pipeline
    const builder = new HtmlAstBuilder();
    const visitor = new HtmlAstVisitor(builder);

    // Parse HTML using Cheerio
    const $ = cheerio.load(html, { xmlMode: false }, false);
    
    // Root element traversal
    const rootNode = new CheerioHtmlNode($.root(), $);
    visitor.visit(rootNode);

    const blocks = builder.getBlocks();

    if (blocks.length === 0) {
      throw new EmptyDocumentError('DOCX text extraction yielded no usable text.');
    }

    const metadata = {
      warnings: result.messages.map((m: any) => m.message),
      title: extractDocxTitle(rawData),
    };

    return ExtractedDocumentFactory.fromBlocks(blocks, metadata);
  }
}
