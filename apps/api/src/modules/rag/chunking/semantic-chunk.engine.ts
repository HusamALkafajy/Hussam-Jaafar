import { Injectable, Inject, Optional } from '@nestjs/common';
import { ExtractedDocument } from '../../files/contracts/extracted-document';
import { StructuralBlock } from '@studyai/ast';
import { SemanticChunk } from './contracts/semantic-chunk';
import { TokenEstimator } from './contracts/token-estimator';
import * as crypto from 'crypto';

export interface ChunkingOptions {
  maxTokens?: number;
  minTokens?: number;
  signal?: AbortSignal;
}

@Injectable()
export class SemanticChunkEngine {
  private readonly maxTokens: number;
  private readonly minTokens: number;

  constructor(
    @Inject('TOKEN_ESTIMATOR') private readonly tokenEstimator: TokenEstimator,
    @Optional() @Inject('CHUNKING_OPTIONS') private readonly options?: ChunkingOptions
  ) {
    this.maxTokens = options?.maxTokens ?? 512;
    this.minTokens = options?.minTokens ?? 50;
  }

  public chunkDocument(documentId: string, document: ExtractedDocument): SemanticChunk[] {
    const rawChunks = this.buildRawChunks(documentId, document.blocks);
    const mergedChunks = this.mergeUndersizedChunks(rawChunks);
    return this.finalizeChunks(mergedChunks);
  }

  private buildRawChunks(documentId: string, blocks: StructuralBlock[]): SemanticChunk[] {
    const chunks: SemanticChunk[] = [];
    let currentChunkContent: StructuralBlock[] = [];
    let currentBlockRefs: number[] = [];
    let currentPlainText = '';
    let currentEstimatedTokens = 0;
    
    let headingHierarchy: Record<number, string> = {};
    let sectionPath: string[] = [];

    const flushChunk = () => {
      if (currentChunkContent.length > 0) {
        chunks.push(this.createDraftChunk(
          documentId,
          chunks.length,
          [...sectionPath],
          { ...headingHierarchy },
          [...currentBlockRefs],
          currentPlainText,
          [...currentChunkContent],
          currentEstimatedTokens
        ));
        currentChunkContent = [];
        currentBlockRefs = [];
        currentPlainText = '';
        currentEstimatedTokens = 0;
      }
    };

    for (let i = 0; i < blocks.length; i++) {
      if (this.options?.signal?.aborted) {
        throw new Error('Chunking aborted or timed out');
      }

      const block = blocks[i];

      // 1. Check if it's a heading to update hierarchy and force flush
      if (block.type.startsWith('heading_')) {
        flushChunk();
        const level = parseInt(block.type.split('_')[1] || '1', 10);
        
        // Update hierarchy
        headingHierarchy[level] = block.text;
        // Clear deeper levels
        for (let j = level + 1; j <= 6; j++) {
          delete headingHierarchy[j];
        }
        
        // Rebuild section path
        sectionPath = Object.keys(headingHierarchy)
          .map(Number)
          .sort((a, b) => a - b)
          .map(k => headingHierarchy[k]!);

        // A heading itself is just a marker, but it's part of the text, so we start a new chunk with it
        currentChunkContent.push(block);
        currentBlockRefs.push(i);
        currentPlainText += (currentPlainText ? '\n\n' : '') + block.text;
        currentEstimatedTokens += this.tokenEstimator.estimateTokens(block.text);
        continue;
      }

      // 2. Estimate tokens for the current block
      let blockTokens = this.tokenEstimator.estimateTokens(block.text);

      // 3. Structural boundary logic (e.g. huge blocks)
      if (blockTokens > this.maxTokens) {
        // If we already have accumulated items, flush them first
        flushChunk();
        
        // Split the oversized block
        const splitBlocks = this.splitOversizedBlock(block, i);
        for (const subBlock of splitBlocks) {
          const subTokens = this.tokenEstimator.estimateTokens(subBlock.text);
          chunks.push(this.createDraftChunk(
            documentId,
            chunks.length,
            [...sectionPath],
            { ...headingHierarchy },
            [i], // they all refer to the same original block
            subBlock.text,
            [subBlock],
            subTokens
          ));
        }
        continue; // handled the oversized block completely
      }

      // 4. Soft boundary (max tokens reached)
      if (currentEstimatedTokens + blockTokens > this.maxTokens) {
        // Flush what we have, start fresh
        flushChunk();
      }

      // 5. Accumulate normally
      currentChunkContent.push(block);
      currentBlockRefs.push(i);
      currentPlainText += (currentPlainText ? '\n\n' : '') + block.text;
      currentEstimatedTokens += blockTokens;
    }

    // Flush remaining
    flushChunk();

    return chunks;
  }

  private splitOversizedBlock(block: StructuralBlock, originalIndex: number): StructuralBlock[] {
    // If a single block (e.g. massive paragraph) is over budget, split by newlines or roughly by length.
    // For safety and AST consistency, we slice text and preserve metadata.
    const subBlocks: StructuralBlock[] = [];
    const maxChars = this.maxTokens * 4; // inverse heuristic

    // Split roughly by chunks of maxChars without breaking words
    let remaining = block.text;
    while (remaining.length > 0) {
      if (remaining.length <= maxChars) {
        subBlocks.push({ ...block, text: remaining });
        break;
      }
      
      // Find a space near the maxChars limit
      let sliceIndex = remaining.lastIndexOf(' ', maxChars);
      if (sliceIndex === -1) sliceIndex = maxChars; // Force split if no space
      
      const part = remaining.substring(0, sliceIndex).trim();
      if (part) {
        subBlocks.push({ ...block, text: part });
      }
      remaining = remaining.substring(sliceIndex).trim();
    }

    return subBlocks;
  }

  private mergeUndersizedChunks(chunks: SemanticChunk[]): SemanticChunk[] {
    if (chunks.length <= 1) return chunks;

    const merged: SemanticChunk[] = [];
    let current = chunks[0]!;

    for (let i = 1; i < chunks.length; i++) {
      const next = chunks[i]!;

      // Can we merge?
      const samePath = JSON.stringify(current.sectionPath) === JSON.stringify(next.sectionPath);
      const combinedTokens = current.estimatedTokens + next.estimatedTokens;

      if (current.estimatedTokens < this.minTokens && samePath && combinedTokens <= this.maxTokens) {
        // Merge next into current
        current.chunkContent.push(...next.chunkContent);
        current.blockReferences.push(...next.blockReferences);
        current.plainText += '\n\n' + next.plainText;
        current.estimatedTokens = combinedTokens;
      } else {
        // Cannot merge, push current and slide window
        merged.push(current);
        current = next;
      }
    }
    
    // push the last one
    merged.push(current);

    return merged;
  }

  private finalizeChunks(chunks: SemanticChunk[]): SemanticChunk[] {
    // We must assign deterministic chunkHash, chunkId, order, prev/next links
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      chunk.chunkOrder = i;
      chunk.previousChunkId = i > 0 ? this.generateChunkId(chunk.documentId, i - 1) : null;
      chunk.nextChunkId = i < chunks.length - 1 ? this.generateChunkId(chunk.documentId, i + 1) : null;
      chunk.chunkId = this.generateChunkId(chunk.documentId, i);
      
      // chunkHash derived from AST subtree explicitly
      const hashPayload = {
        sectionPath: chunk.sectionPath,
        content: chunk.chunkContent.map(b => ({ type: b.type, text: b.text, metadata: b.metadata }))
      };
      
      chunk.chunkHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(hashPayload))
        .digest('hex');
        
      if (i > 0) {
        chunk.parentChunkId = chunks[i - 1]!.chunkId; // Simple sequential parental chain or derived from hierarchy if preferred
      } else {
        chunk.parentChunkId = null;
      }
    }
    return chunks;
  }

  private generateChunkId(documentId: string, order: number): string {
    return crypto
      .createHash('sha256')
      .update(`${documentId}-chunk-${order}`)
      .digest('hex');
  }

  private createDraftChunk(
    documentId: string,
    order: number,
    sectionPath: string[],
    headingHierarchy: Record<number, string>,
    blockReferences: number[],
    plainText: string,
    chunkContent: StructuralBlock[],
    estimatedTokens: number
  ): SemanticChunk {
    return {
      chunkId: '', // Filled in finalize
      chunkHash: '', // Filled in finalize
      parentChunkId: null,
      documentId,
      chunkOrder: order,
      sectionPath,
      headingHierarchy,
      blockReferences,
      plainText,
      chunkContent,
      structuralMetadata: {},
      estimatedTokens,
      previousChunkId: null,
      nextChunkId: null
    };
  }
}
