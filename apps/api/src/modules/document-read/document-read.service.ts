import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DocumentQueryService, db, eq, desc, files, documentVersions } from '@studyai/database';
import { PaginationDto, AncestorsDto, ExpandContextDto } from './dto/read.dto';

export interface BootstrapResponse {
  fileId: string;
  versionId: string | null;
  status: string;
  roots: any[];
}

@Injectable()
export class DocumentReadService {

  // Validate ownership and return version details
  async validateAccessAndGetVersion(userId: string, fileIdOrVersionId: string, isVersionId: boolean = false): Promise<{ fileId: string; versionId: string | null; status: string }> {
    if (isVersionId) {
      const versionResult = await db.select({
        fileId: documentVersions.fileId,
        versionId: documentVersions.id,
      }).from(documentVersions).where(eq(documentVersions.id, fileIdOrVersionId)).limit(1);

      if (!versionResult.length) {
        throw new NotFoundException('Version not found');
      }

      const fileResult = await db.select({
        userId: files.userId,
        status: files.processingStatus,
      }).from(files).where(eq(files.id, versionResult[0].fileId)).limit(1);

      if (!fileResult.length) {
        throw new NotFoundException('File not found');
      }

      if (fileResult[0].userId !== userId) {
        throw new NotFoundException('Version not found');
      }

      return { fileId: versionResult[0].fileId, versionId: fileIdOrVersionId, status: fileResult[0].status };
    } else {
      const fileResult = await db.select({
        userId: files.userId,
        status: files.processingStatus,
      }).from(files).where(eq(files.id, fileIdOrVersionId)).limit(1);

      if (!fileResult.length) {
        throw new NotFoundException('File not found');
      }

      if (fileResult[0].userId !== userId) {
        throw new NotFoundException('File not found');
      }

      // Find latest version (for now just any version since processing is missing)
      const versionResult = await db.select({
        id: documentVersions.id,
      }).from(documentVersions)
        .where(eq(documentVersions.fileId, fileIdOrVersionId))
        .orderBy(desc(documentVersions.createdAt))
        .limit(1);

      return { fileId: fileIdOrVersionId, versionId: versionResult.length ? versionResult[0].id : null, status: fileResult[0].status };
    }
  }

  async bootstrap(userId: string, fileId: string): Promise<BootstrapResponse> {
    const { versionId, status } = await this.validateAccessAndGetVersion(userId, fileId, false);
    
    let roots: any[] = [];
    if (versionId) {
      const result = await DocumentQueryService.getChildren(versionId, null, 100);
      roots = result.data;
    }

    return { fileId, versionId, status, roots };
  }

  async getNode(userId: string, versionId: string, nodeId: string) {
    await this.validateAccessAndGetVersion(userId, versionId, true);
    const result = await DocumentQueryService.getNode(versionId, nodeId);
    if (!result.data) {
      throw new NotFoundException('Node not found');
    }
    return result;
  }

  async getChildren(userId: string, versionId: string, parentId: string | null, query: PaginationDto) {
    await this.validateAccessAndGetVersion(userId, versionId, true);
    return DocumentQueryService.getChildren(versionId, parentId, query.limit, query.cursor);
  }

  async getWindowForParent(userId: string, versionId: string, parentId: string | null, cursor: string, query: PaginationDto) {
    await this.validateAccessAndGetVersion(userId, versionId, true);
    return DocumentQueryService.getWindow(versionId, parentId, cursor, query.limit);
  }

  async getHeadingTree(userId: string, versionId: string) {
    await this.validateAccessAndGetVersion(userId, versionId, true);
    return DocumentQueryService.getHeadingTree(versionId);
  }

  async getAncestors(userId: string, versionId: string, nodeId: string) {
    await this.validateAccessAndGetVersion(userId, versionId, true);
    return DocumentQueryService.getAncestors(versionId, nodeId);
  }

  async getDescendants(userId: string, versionId: string, nodeId: string, query: AncestorsDto) {
    await this.validateAccessAndGetVersion(userId, versionId, true);
    const safeDepth = Math.min(query.depthLimit, 20);
    return DocumentQueryService.getDescendants(versionId, nodeId, safeDepth);
  }

  async expandContext(userId: string, versionId: string, nodeId: string, query: ExpandContextDto) {
    await this.validateAccessAndGetVersion(userId, versionId, true);
    const safeBefore = Math.min(query.before, 50);
    const safeAfter = Math.min(query.after, 50);
    return DocumentQueryService.expandContext(versionId, nodeId, safeBefore, safeAfter);
  }
}
