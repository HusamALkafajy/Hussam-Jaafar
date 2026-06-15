import { Injectable, Logger } from '@nestjs/common';
import { db, documentChunks, eq, and, sql } from '@studyai/database';
import { AiService } from '../ai/ai.service';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(private readonly aiService: AiService) {}

  // 1. Recursive chunking of document text (typically 800 characters with 150 characters overlap)
  private chunkText(text: string, chunkSize = 800, overlap = 150): Array<{ content: string; pageNumber: number }> {
    const chunks: Array<{ content: string; pageNumber: number }> = [];
    if (!text) return chunks;

    // Detect page boundary delimiters (e.g., standard form feeds, PDF page indicators)
    const pages = text.split(/\f|--- Page \d+ ---|\[Page \d+\]/i);
    
    let currentPage = 1;
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const pageText = pages[pIdx].trim();
      if (!pageText) continue;
      
      const pageNum = pIdx + 1;
      let start = 0;
      
      while (start < pageText.length) {
        const end = Math.min(start + chunkSize, pageText.length);
        const chunk = pageText.substring(start, end).trim();
        if (chunk.length > 30) {
          chunks.push({
            content: chunk,
            pageNumber: pageNum,
          });
        }
        start += (chunkSize - overlap);
      }
    }
    
    // Fallback sliding window if no chunks were generated
    if (chunks.length === 0) {
      let start = 0;
      while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push({
          content: text.substring(start, end).trim(),
          pageNumber: 1,
        });
        start += (chunkSize - overlap);
      }
    }
    
    return chunks;
  }

  // 2. Index a file: split text into chunks, generate embeddings, and insert into DB
  async indexFile(fileId: string, text: string) {
    this.logger.log(`Indexing file ID: ${fileId} for Advanced RAG...`);
    
    // Remove any previously indexed chunks to prevent duplicate entries
    await db.delete(documentChunks).where(eq(documentChunks.fileId, fileId));

    const chunks = this.chunkText(text);
    this.logger.log(`Split file ${fileId} into ${chunks.length} chunks. Generating embeddings...`);

    const chunkValues = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedding = await this.aiService.getEmbedding(chunk.content);
        chunkValues.push({
          fileId,
          chunkIndex: i,
          content: chunk.content,
          pageNumber: chunk.pageNumber,
          embedding,
        });
      } catch (err) {
        this.logger.error(`Failed to generate embedding for chunk index ${i} on file ${fileId}:`, err);
      }
    }

    if (chunkValues.length > 0) {
      await db.insert(documentChunks).values(chunkValues);
      this.logger.log(`Indexed ${chunkValues.length} chunks for file ${fileId} successfully.`);
    }
  }

  // 3. Perform semantic vector search on file chunks using pgvector Cosine similarity
  async searchChunks(
    fileId: string,
    query: string,
    limit = 5,
  ): Promise<Array<{ content: string; pageNumber: number; similarity: number }>> {
    try {
      const queryEmbedding = await this.aiService.getEmbedding(query);
      const vectorStr = `[${queryEmbedding.join(',')}]`;
      
      // Cosine similarity in pgvector is 1 - (embedding <=> query_embedding)
      const similarity = sql<number>`1 - (${documentChunks.embedding} <=> ${vectorStr}::vector)`;
      
      const results = await db
        .select({
          content: documentChunks.content,
          pageNumber: documentChunks.pageNumber,
          similarity,
        })
        .from(documentChunks)
        .where(eq(documentChunks.fileId, fileId))
        .orderBy(sql`${documentChunks.embedding} <=> ${vectorStr}::vector`)
        .limit(limit);

      return results.map((r) => ({
        content: r.content,
        pageNumber: r.pageNumber || 1,
        similarity: Number(r.similarity),
      }));
    } catch (err) {
      this.logger.error(`Vector search query failed on file ${fileId}:`, err);
      return [];
    }
  }
}
