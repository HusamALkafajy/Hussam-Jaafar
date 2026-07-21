import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  db,
  chatSessions,
  chatMessages,
  files,
  eq,
  and,
  desc,
  asc,
  sql,
} from '@studyai/database';
import { AiService } from '../ai/ai.service';
import { RagService } from '../rag/rag.service';
import { StudyGroupsService } from '../study-groups/study-groups.service';
import { DocumentReadService } from '../document-read/document-read.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { buildRagContext } from '../ai/prompts/chat.prompts';

/** How many recent messages to include as conversation history */
const HISTORY_WINDOW = 10;

/** How many RAG chunks to retrieve per question */
const RAG_CHUNK_LIMIT = 5;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly ragService: RagService,
    private readonly studyGroupsService: StudyGroupsService,
    private readonly documentReadService: DocumentReadService,
  ) {}

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  async createSession(userId: string, dto: CreateSessionDto) {
    // Verify the file belongs to this user OR is shared in a group the user is a member of
    const fileResult = await db
      .select()
      .from(files)
      .where(eq(files.id, dto.fileId))
      .limit(1);

    if (fileResult.length === 0) {
      throw new NotFoundException('File not found.');
    }

    const file = fileResult[0];

    // Access check: owner OR shared group member
    if (file.userId !== userId) {
      const isShared = await this.studyGroupsService.isFileSharedWithUser(dto.fileId, userId);
      if (!isShared) {
        throw new NotFoundException('File not found or access denied.');
      }
    }

    if (!file.extractedText) {
      throw new BadRequestException(
        'This file has not been analyzed yet. Please analyze the file before starting a chat.',
      );
    }

    const sessionResult = await db
      .insert(chatSessions)
      .values({
        fileId: dto.fileId,
        userId,
        title: `محادثة: ${file.originalName}`,
        messageCount: 0,
      })
      .returning();

    return sessionResult[0];
  }

  async findAllSessions(userId: string) {
    return db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt));
  }

  async findSessionById(sessionId: string, userId: string) {
    const sessionResult = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);

    if (sessionResult.length === 0) {
      throw new NotFoundException('Chat session not found.');
    }

    const session = sessionResult[0];

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt));

    return { ...session, messages };
  }

  async deleteSession(sessionId: string, userId: string) {
    const sessionResult = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);

    if (sessionResult.length === 0) {
      throw new NotFoundException('Chat session not found.');
    }

    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Messaging — RAG-Powered
  // ---------------------------------------------------------------------------

  async sendMessage(sessionId: string, userId: string, dto: SendMessageDto) {
    // 1. Verify session ownership and get fileId
    const sessionResult = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);

    if (sessionResult.length === 0) {
      throw new NotFoundException('Chat session not found.');
    }

    const session = sessionResult[0];

    // 2. Save the user message first for immediate consistency
    await db.insert(chatMessages).values({
      sessionId,
      role: 'user',
      content: dto.content,
      references: null,
    });

    // 3. Load recent conversation history for context (last N messages)
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(HISTORY_WINDOW);

    // History from DB is newest-first; reverse for chronological order
    // Exclude the message we just inserted (the current user message)
    const conversationHistory = history
      .reverse()
      .slice(0, -1) // remove the last item (the just-inserted user message)
      .map((m) => ({ role: m.role, content: m.content }));

    // 4. Retrieve semantically relevant document chunks via pgvector
    // Resolve the active version for this file
    const { versionId } = await this.documentReadService.resolveActiveReadableVersion(session.fileId, session.userId);
    
    let ragChunks: any[] = [];
    if (versionId) {
      this.logger.log(`Retrieving RAG chunks for session ${sessionId}, version ${versionId}...`);
      ragChunks = await this.ragService.searchChunks(
        versionId,
        dto.content,
        RAG_CHUNK_LIMIT,
      );
    } else {
      this.logger.log(`No active version found for file ${session.fileId}, skipping RAG context.`);
    }

    const ragContext = buildRagContext(ragChunks);

    // 5. Call the AI with RAG context + conversation history
    this.logger.log(`Calling AI for session ${sessionId}...`);
    const aiResponse = await this.aiService.chatWithDocument(
      ragContext,
      dto.content,
      conversationHistory,
    );

    const assistantContent: string = aiResponse?.content || 'عذراً، لم أتمكن من توليد إجابة. يرجى المحاولة مرة أخرى.';
    const references = aiResponse?.references || [];

    // 6. Save the assistant message
    const assistantMessageResult = await db
      .insert(chatMessages)
      .values({
        sessionId,
        role: 'assistant',
        content: assistantContent,
        references,
      })
      .returning();

    // 7. Update session metadata
    await db
      .update(chatSessions)
      .set({
        messageCount: sql`${chatSessions.messageCount} + 2`,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    return assistantMessageResult[0];
  }
}
