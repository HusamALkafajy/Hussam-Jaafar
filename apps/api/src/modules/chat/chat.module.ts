import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AiModule } from '../ai/ai.module';
import { RagModule } from '../rag/rag.module';
import { StudyGroupsModule } from '../study-groups/study-groups.module';
import { DocumentReadModule } from '../document-read/document-read.module';

@Module({
  imports: [AiModule, RagModule, StudyGroupsModule, DocumentReadModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
