import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { StudyGroupsService } from './study-groups.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { ShareFileDto } from './dto/share-file.dto';

@Controller('study-groups')
@UseGuards(JwtAuthGuard)
export class StudyGroupsController {
  constructor(private readonly studyGroupsService: StudyGroupsService) {}

  // ── Group CRUD ──────────────────────────────────────────────────────────────

  @Post()
  createGroup(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.studyGroupsService.createGroup(userId, dto);
  }

  @Get()
  listMyGroups(@CurrentUser('sub') userId: string) {
    return this.studyGroupsService.listMyGroups(userId);
  }

  @Get(':id')
  getGroupDetail(
    @CurrentUser('sub') userId: string,
    @Param('id') groupId: string,
  ) {
    return this.studyGroupsService.getGroupDetail(groupId, userId);
  }

  @Delete(':id')
  deleteGroup(
    @CurrentUser('sub') userId: string,
    @Param('id') groupId: string,
  ) {
    return this.studyGroupsService.deleteGroup(groupId, userId);
  }

  // ── Membership ──────────────────────────────────────────────────────────────

  /** Join a group using an invite code: POST /study-groups/join/:inviteCode */
  @Post('join/:inviteCode')
  joinByInviteCode(
    @CurrentUser('sub') userId: string,
    @Param('inviteCode') inviteCode: string,
  ) {
    return this.studyGroupsService.joinByInviteCode(userId, inviteCode);
  }

  @Delete(':id/leave')
  leaveGroup(
    @CurrentUser('sub') userId: string,
    @Param('id') groupId: string,
  ) {
    return this.studyGroupsService.leaveGroup(groupId, userId);
  }

  // ── Messages (REST: history fetch) ──────────────────────────────────────────

  @Get(':id/messages')
  getMessages(
    @CurrentUser('sub') userId: string,
    @Param('id') groupId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.studyGroupsService.getMessages(groupId, userId, page);
  }

  /** Fallback REST send (WebSocket is the primary channel) */
  @Post(':id/messages')
  sendMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') groupId: string,
    @Body() dto: SendGroupMessageDto,
  ) {
    return this.studyGroupsService.sendMessage(groupId, userId, dto);
  }

  // ── File Sharing ─────────────────────────────────────────────────────────────

  @Post(':id/files')
  shareFile(
    @CurrentUser('sub') userId: string,
    @Param('id') groupId: string,
    @Body() dto: ShareFileDto,
  ) {
    return this.studyGroupsService.shareFile(groupId, userId, dto.fileId);
  }

  @Delete(':id/files/:fileId')
  removeSharedFile(
    @CurrentUser('sub') userId: string,
    @Param('id') groupId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.studyGroupsService.removeSharedFile(groupId, userId, fileId);
  }
}
