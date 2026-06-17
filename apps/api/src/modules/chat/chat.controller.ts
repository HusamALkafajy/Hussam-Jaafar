import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat-sessions')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** Create a new chat session for a given file */
  @Post()
  async createSession(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSessionDto,
  ) {
    return this.chatService.createSession(userId, dto);
  }

  /** List all chat sessions for the current user */
  @Get()
  async getSessions(@CurrentUser('sub') userId: string) {
    return this.chatService.findAllSessions(userId);
  }

  /** Get a specific session with its full message history */
  @Get(':id')
  async getSession(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.chatService.findSessionById(id, userId);
  }

  /** Delete a chat session and all its messages */
  @Delete(':id')
  async deleteSession(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.chatService.deleteSession(id, userId);
  }

  /** Send a message and receive an AI tutor response */
  @Post(':id/messages')
  async sendMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(id, userId, dto);
  }
}
