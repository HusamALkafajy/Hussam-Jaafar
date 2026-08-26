import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { db, chatSessions, chatMessages, files, eq, and, desc, sql } from '@studyai/database';
import { AiService } from '../ai/ai.service';
import { DocumentReadService } from '../document-read/document-read.service';
import { RetrievalOrchestrator } from './retrieval.orchestrator';
import { PedagogicalContextBuilder } from './pedagogical-context.builder';
import { getStoredDocumentTitle } from '../files/utils/document-title.util';

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly documentReadService: DocumentReadService,
    private readonly orchestrator: RetrievalOrchestrator,
    private readonly contextBuilder: PedagogicalContextBuilder,
  ) {}

  private async getOrCreateTutorSession(documentId: string, userId: string) {
    const fileResult = await db.select().from(files).where(eq(files.id, documentId)).limit(1);
    if (!fileResult.length) {
      throw new NotFoundException('Document not found');
    }

    if (fileResult[0].userId !== userId) {
       // Shared file support could be added here if needed, but keeping it simple for now
       throw new NotFoundException('Document not found');
    }

    const tutorSessionTitle = `AI Tutor: ${getStoredDocumentTitle(fileResult[0].metadata, fileResult[0].originalName)}`;

    // Look for an existing tutor session
    const existingSessions = await db.select()
      .from(chatSessions)
      .where(and(
        eq(chatSessions.fileId, documentId),
        eq(chatSessions.userId, userId),
        eq(chatSessions.title, tutorSessionTitle)
      ))
      .limit(1);

    if (existingSessions.length > 0) {
      return existingSessions[0];
    }

    // Create one if none exists
    const newSession = await db.insert(chatSessions)
      .values({
        fileId: documentId,
        userId,
        title: tutorSessionTitle,
        messageCount: 0,
      })
      .returning();

    return newSession[0];
  }

  async getHistory(documentId: string, userId: string) {
    const session = await this.getOrCreateTutorSession(documentId, userId);
    
    const messages = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, session.id))
      .orderBy(chatMessages.createdAt);

    return {
      sessionId: session.id,
      messages
    };
  }

  async deleteHistory(documentId: string, userId: string) {
    const session = await this.getOrCreateTutorSession(documentId, userId);
    
    await db.delete(chatSessions).where(eq(chatSessions.id, session.id));
    return { success: true };
  }

  async chat(documentId: string, userId: string, question: string) {
    const session = await this.getOrCreateTutorSession(documentId, userId);

    // 1. Resolve Active Version
    const { versionId } = await this.documentReadService.resolveActiveReadableVersion(documentId, userId);
    if (!versionId) {
      throw new BadRequestException('Document has no processed version available.');
    }

    // 2. Fetch Conversation History (last 10 messages)
    const historyResult = await db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
      })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, session.id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(10);
    const history = historyResult.reverse();

    // 3. Retrieval Pipeline
    const evidence = await this.orchestrator.gatherEvidence(documentId, versionId, question);
    
    // 4. Context Building
    const pedagogicalContext = this.contextBuilder.buildContext(evidence);

    // 5. Save User Message
    await db.insert(chatMessages).values({
      sessionId: session.id,
      role: 'user',
      content: question,
    });

    // 6. Generate Response
    const responseText = await this.aiService.chatWithTutor(
      pedagogicalContext,
      question,
      history
    );

    // 7. Save Assistant Message with Citations
    const newAssistantMessage = await db.insert(chatMessages)
      .values({
        sessionId: session.id,
        role: 'assistant',
        content: responseText,
        references: JSON.stringify(evidence.citations.map(c => ({ text: c }))),
      })
      .returning();

    // 8. Update session count
    await db.update(chatSessions)
      .set({
        messageCount: sql`${chatSessions.messageCount} + 2`,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, session.id));

    return newAssistantMessage[0];
  }
}
