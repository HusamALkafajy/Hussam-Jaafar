import { Injectable, Logger } from '@nestjs/common';
import { db, files, fileProcessingAttempts, documentVersions, DatabaseExecutor } from '@studyai/database';
import { eq, and, sql } from 'drizzle-orm';
import { WorkerExecutionToken } from '../types/worker-execution-token.type';
import { StructuralBlock } from '@studyai/ast';
import { ASTBuilder } from '@studyai/ast';
import { DocumentRepository } from '@studyai/database';
import { RagService } from '../../rag/rag.service';
import { LostProcessingOwnershipError } from '../utils/domain.exceptions';

export interface PublicationPayload {
  token: WorkerExecutionToken;
  fileId: string;
  structuralBlocks: StructuralBlock[];
  generatedChunks: any[];
  extractedText?: string;
}

@Injectable()
export class DocumentPersistenceService {
  private readonly logger = new Logger(DocumentPersistenceService.name);
  private readonly documentRepo = new DocumentRepository();

  constructor(
    private readonly ragService: RagService,
  ) {}

  async publish(payload: PublicationPayload): Promise<void> {
    const { token, fileId, structuralBlocks, generatedChunks, extractedText } = payload;

    if (token.fileId !== fileId) {
      throw new Error(`Token fileId mismatch. Expected ${fileId}, got ${token.fileId}`);
    }

    await db.transaction(async (tx) => {
      // 1. Lock the parent file publication sequence
      const [lockedFile] = await tx
        .select()
        .from(files)
        .where(eq(files.id, fileId))
        .for('update');

      if (!lockedFile) {
        throw new Error(`File ${fileId} not found during publication lock`);
      }

      // 2. Check attempt idempotency (has it already published?)
      const [existingVersion] = await tx
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.attemptId, token.attemptId));

      if (existingVersion) {
        this.logger.log(`Attempt ${token.attemptId} already published version ${existingVersion.versionNumber}. Idempotent success.`);
        return;
      }

      // 3. Validate publication ownership
      const [attempt] = await tx
        .select()
        .from(fileProcessingAttempts)
        .where(eq(fileProcessingAttempts.id, token.attemptId));

      if (!attempt) {
        throw new LostProcessingOwnershipError(`Attempt ${token.attemptId} not found`);
      }
      if (attempt.fileId !== fileId) {
        throw new LostProcessingOwnershipError(`Attempt ${token.attemptId} does not belong to file ${fileId}`);
      }
      if (attempt.processingAttempts !== token.generation) {
        throw new LostProcessingOwnershipError(`Worker generation mismatch: attempt generation ${attempt.processingAttempts} !== token generation ${token.generation}`);
      }
      if (attempt.status !== 'processing') {
        throw new LostProcessingOwnershipError(`Attempt ${token.attemptId} is not in processing state (current: ${attempt.status})`);
      }

      // 4. Allocate versionNumber
      const [maxVersionResult] = await tx
        .select({ maxVersion: sql<number>`MAX(${documentVersions.versionNumber})` })
        .from(documentVersions)
        .where(eq(documentVersions.fileId, fileId));

      const currentMaximum = maxVersionResult?.maxVersion || 0;
      const nextVersionNumber = currentMaximum + 1;

      // 5. Create document version
      const [newVersion] = await tx
        .insert(documentVersions)
        .values({
          fileId,
          attemptId: token.attemptId,
          versionNumber: nextVersionNumber,
        })
        .returning({ id: documentVersions.id });

      const versionId = newVersion.id;

      // 6. Build and persist AST
      const astManifest = ASTBuilder.buildAndValidate(structuralBlocks, { versionId });

      if (!astManifest.success) {
        throw new Error(`AST build failed for file ${fileId} version ${versionId}: ${JSON.stringify(astManifest.builderErrors)}`);
      }

      const insertNodes = astManifest.nodes.map(node => ({
        id: node.id,
        fileId: fileId,
        versionId: versionId,
        parentId: node.parent_id,
        nodeType: node.node_type as any,
        lexoRank: node.lexo_rank,
        content: node.content || {},
        metadata: node.metadata || {},
      }));

      const persistAstResult = await this.documentRepo.persistNodes(insertNodes, tx);
      if (!persistAstResult.success) {
        throw new Error(`AST persistence failed for file ${fileId} version ${versionId}: ${persistAstResult.error}`);
      }

      // 7. Persist version-scoped RAG chunks
      await this.ragService.persistChunks(versionId, generatedChunks, tx);

      // 8. Atomic terminal transition for attempt
      const attemptUpdate = await tx
        .update(fileProcessingAttempts)
        .set({
          status: 'completed',
          finishedAt: new Date(),
        })
        .where(
          and(
            eq(fileProcessingAttempts.id, token.attemptId),
            eq(fileProcessingAttempts.processingAttempts, token.generation),
            eq(fileProcessingAttempts.status, 'processing')
          )
        )
        .returning({ id: fileProcessingAttempts.id });

      if (attemptUpdate.length === 0) {
        throw new LostProcessingOwnershipError(`Failed to transition attempt ${token.attemptId} to completed. Ownership lost during transaction.`);
      }

      // 9. Transition file to completed
      await tx
        .update(files)
        .set({
          processingStatus: 'completed',
          processedAt: new Date(),
          ...(extractedText ? { extractedText } : {})
        })
        .where(eq(files.id, fileId));

      this.logger.log(`Successfully published version ${nextVersionNumber} (ID: ${versionId}) for file ${fileId}`);
    });
  }
}
