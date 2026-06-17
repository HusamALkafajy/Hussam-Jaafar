import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  db,
  studyGroups,
  groupMembers,
  groupMessages,
  groupSharedFiles,
  files,
  users,
  eq,
  and,
  desc,
  asc,
  sql,
} from '@studyai/database';
import { CreateGroupDto } from './dto/create-group.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import * as crypto from 'crypto';

@Injectable()
export class StudyGroupsService {
  private readonly logger = new Logger(StudyGroupsService.name);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Generate a random 8-character alphanumeric invite code */
  private generateInviteCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F1B9C2"
  }

  /** Verify the user is a member of the group. Throws ForbiddenException if not. */
  async assertMembership(groupId: string, userId: string) {
    const membership = await db
      .select({ role: groupMembers.role })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
      .limit(1);

    if (membership.length === 0) {
      throw new ForbiddenException('You are not a member of this group.');
    }
    return membership[0].role;
  }

  // ── Session Management ────────────────────────────────────────────────────

  async createGroup(userId: string, dto: CreateGroupDto) {
    const inviteCode = this.generateInviteCode();

    const result = await db.transaction(async (tx) => {
      const [group] = await tx
        .insert(studyGroups)
        .values({
          name: dto.name,
          description: dto.description ?? null,
          inviteCode,
          ownerId: userId,
          isPublic: dto.isPublic ?? false,
        })
        .returning();

      // Insert creator as owner
      await tx.insert(groupMembers).values({
        groupId: group.id,
        userId,
        role: 'owner',
      });

      return group;
    });

    this.logger.log(`Group "${result.name}" created by user ${userId}. InviteCode: ${result.inviteCode}`);
    return result;
  }

  async joinByInviteCode(userId: string, inviteCode: string) {
    const groupResult = await db
      .select()
      .from(studyGroups)
      .where(eq(studyGroups.inviteCode, inviteCode.toUpperCase()))
      .limit(1);

    if (groupResult.length === 0) {
      throw new NotFoundException('Invalid invite code. No group found.');
    }

    const group = groupResult[0];

    // Check if already a member
    const existingMembership = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)))
      .limit(1);

    if (existingMembership.length > 0) {
      throw new ConflictException('You are already a member of this group.');
    }

    // Check member capacity
    const countResult = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, group.id));

    if (countResult[0].count >= group.maxMembers) {
      throw new BadRequestException(`This group has reached its maximum capacity of ${group.maxMembers} members.`);
    }

    await db.insert(groupMembers).values({ groupId: group.id, userId, role: 'member' });
    this.logger.log(`User ${userId} joined group ${group.id}`);
    return group;
  }

  async listMyGroups(userId: string) {
    // Fetch groups the user is a member of, with member count
    const rows = await db
      .select({
        id: studyGroups.id,
        name: studyGroups.name,
        description: studyGroups.description,
        inviteCode: studyGroups.inviteCode,
        isPublic: studyGroups.isPublic,
        ownerId: studyGroups.ownerId,
        maxMembers: studyGroups.maxMembers,
        createdAt: studyGroups.createdAt,
        updatedAt: studyGroups.updatedAt,
        myRole: groupMembers.role,
      })
      .from(groupMembers)
      .innerJoin(studyGroups, eq(groupMembers.groupId, studyGroups.id))
      .where(eq(groupMembers.userId, userId))
      .orderBy(desc(studyGroups.updatedAt));

    return rows;
  }

  async getGroupDetail(groupId: string, userId: string) {
    // Verify membership
    const myRole = await this.assertMembership(groupId, userId);

    const groupResult = await db
      .select()
      .from(studyGroups)
      .where(eq(studyGroups.id, groupId))
      .limit(1);

    if (groupResult.length === 0) {
      throw new NotFoundException('Group not found.');
    }

    const group = groupResult[0];

    // Fetch members with user info
    const members = await db
      .select({
        id: groupMembers.id,
        userId: groupMembers.userId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(groupMembers.joinedAt));

    // Fetch shared files with uploader info
    const sharedFiles = await db
      .select({
        id: groupSharedFiles.id,
        fileId: groupSharedFiles.fileId,
        sharedAt: groupSharedFiles.sharedAt,
        sharedByUserId: groupSharedFiles.sharedByUserId,
        originalName: files.originalName,
        mimeType: files.mimeType,
        fileSize: files.fileSize,
        processingStatus: files.processingStatus,
      })
      .from(groupSharedFiles)
      .innerJoin(files, eq(groupSharedFiles.fileId, files.id))
      .where(eq(groupSharedFiles.groupId, groupId))
      .orderBy(desc(groupSharedFiles.sharedAt));

    return { ...group, myRole, members, sharedFiles };
  }

  // ── Messaging (REST — used for history fetch; realtime via Gateway) ────────

  async getMessages(groupId: string, userId: string, page = 1, limit = 50) {
    await this.assertMembership(groupId, userId);

    const offset = (page - 1) * limit;

    const messages = await db
      .select({
        id: groupMessages.id,
        content: groupMessages.content,
        createdAt: groupMessages.createdAt,
        senderId: groupMessages.senderId,
        senderFirstName: users.firstName,
        senderLastName: users.lastName,
        senderAvatarUrl: users.avatarUrl,
      })
      .from(groupMessages)
      .innerJoin(users, eq(groupMessages.senderId, users.id))
      .where(eq(groupMessages.groupId, groupId))
      .orderBy(desc(groupMessages.createdAt))
      .limit(limit)
      .offset(offset);

    // Return chronological order (oldest-first) for chat display
    return messages.reverse();
  }

  /**
   * Persist a message to the DB.
   * Called by both the REST controller and the WebSocket gateway.
   */
  async persistMessage(groupId: string, senderId: string, content: string) {
    const [message] = await db
      .insert(groupMessages)
      .values({ groupId, senderId, content })
      .returning();

    // Update updatedAt on the group so listMyGroups sorts correctly
    await db
      .update(studyGroups)
      .set({ updatedAt: new Date() })
      .where(eq(studyGroups.id, groupId));

    return message;
  }

  async sendMessage(groupId: string, userId: string, dto: SendGroupMessageDto) {
    await this.assertMembership(groupId, userId);
    return this.persistMessage(groupId, userId, dto.content);
  }

  // ── File Sharing ──────────────────────────────────────────────────────────

  async shareFile(groupId: string, userId: string, fileId: string) {
    await this.assertMembership(groupId, userId);

    // Verify file belongs to this user
    const fileResult = await db
      .select({ id: files.id, originalName: files.originalName })
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)))
      .limit(1);

    if (fileResult.length === 0) {
      throw new NotFoundException('File not found or you do not own this file.');
    }

    try {
      const [shared] = await db
        .insert(groupSharedFiles)
        .values({ groupId, fileId, sharedByUserId: userId })
        .returning();

      this.logger.log(`File ${fileId} shared into group ${groupId} by user ${userId}`);
      return shared;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('This file is already shared in this group.');
      }
      throw err;
    }
  }

  async removeSharedFile(groupId: string, userId: string, fileId: string) {
    const myRole = await this.assertMembership(groupId, userId);

    // Find the share record
    const shareResult = await db
      .select()
      .from(groupSharedFiles)
      .where(and(eq(groupSharedFiles.groupId, groupId), eq(groupSharedFiles.fileId, fileId)))
      .limit(1);

    if (shareResult.length === 0) {
      throw new NotFoundException('This file is not shared in this group.');
    }

    const share = shareResult[0];
    const canRemove =
      share.sharedByUserId === userId ||
      myRole === 'owner' ||
      myRole === 'admin';

    if (!canRemove) {
      throw new ForbiddenException('Only the uploader, an admin, or the group owner can remove a shared file.');
    }

    await db
      .delete(groupSharedFiles)
      .where(and(eq(groupSharedFiles.groupId, groupId), eq(groupSharedFiles.fileId, fileId)));

    return { success: true };
  }

  // ── Membership Management ─────────────────────────────────────────────────

  async leaveGroup(groupId: string, userId: string) {
    const myRole = await this.assertMembership(groupId, userId);

    if (myRole === 'owner') {
      // Transfer ownership to oldest admin, or oldest member if no admin
      const nextOwner = await db
        .select({ userId: groupMembers.userId, role: groupMembers.role })
        .from(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), sql`${groupMembers.userId} != ${userId}`))
        .orderBy(
          sql`CASE ${groupMembers.role} WHEN 'admin' THEN 0 WHEN 'member' THEN 1 ELSE 2 END`,
          asc(groupMembers.joinedAt),
        )
        .limit(1);

      if (nextOwner.length === 0) {
        // Sole member: delete the group entirely
        await db.delete(studyGroups).where(eq(studyGroups.id, groupId));
        return { success: true, groupDeleted: true };
      }

      // Promote next owner
      await db
        .update(groupMembers)
        .set({ role: 'owner' })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, nextOwner[0].userId)));

      await db
        .update(studyGroups)
        .set({ ownerId: nextOwner[0].userId })
        .where(eq(studyGroups.id, groupId));
    }

    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

    return { success: true, groupDeleted: false };
  }

  async deleteGroup(groupId: string, userId: string) {
    const groupResult = await db
      .select({ ownerId: studyGroups.ownerId })
      .from(studyGroups)
      .where(eq(studyGroups.id, groupId))
      .limit(1);

    if (groupResult.length === 0) {
      throw new NotFoundException('Group not found.');
    }

    if (groupResult[0].ownerId !== userId) {
      throw new ForbiddenException('Only the group owner can delete the group.');
    }

    await db.delete(studyGroups).where(eq(studyGroups.id, groupId));
    return { success: true };
  }

  // ── Used by ChatService for shared-file access check ─────────────────────

  /**
   * Returns true if the file is shared in any group where `userId` is a member.
   */
  async isFileSharedWithUser(fileId: string, userId: string): Promise<boolean> {
    const result = await db
      .select({ id: groupSharedFiles.id })
      .from(groupSharedFiles)
      .innerJoin(groupMembers, eq(groupSharedFiles.groupId, groupMembers.groupId))
      .where(and(eq(groupSharedFiles.fileId, fileId), eq(groupMembers.userId, userId)))
      .limit(1);

    return result.length > 0;
  }
}
