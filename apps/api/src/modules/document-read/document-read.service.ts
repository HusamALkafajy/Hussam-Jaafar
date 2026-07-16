import { Injectable, BadRequestException } from '@nestjs/common';
import { DocumentQueryService } from '@studyai/database';
import { PaginationDto, AncestorsDto, ExpandContextDto } from './dto/read.dto';

@Injectable()
export class DocumentReadService {
  async getNode(id: string) {
    const result = await DocumentQueryService.getNode(id);
    if (!result.data) {
      throw new BadRequestException('Node not found');
    }
    return result;
  }

  async getChildren(parentId: string | null, query: PaginationDto) {
    return DocumentQueryService.getChildren(parentId, query.limit, query.cursor);
  }

  async getWindow(cursor: string, query: PaginationDto) {
    return DocumentQueryService.getWindow(null, cursor, query.limit); // We pass null parent for flat windows, or client needs to pass parentId. 
    // Wait, getWindow is just forward pagination among siblings.
  }

  async getWindowForParent(parentId: string | null, cursor: string, query: PaginationDto) {
    return DocumentQueryService.getWindow(parentId, cursor, query.limit);
  }

  async getHeadingTree(documentId: string) {
    return DocumentQueryService.getHeadingTree(documentId);
  }

  async getAncestors(nodeId: string) {
    return DocumentQueryService.getAncestors(nodeId);
  }

  async getDescendants(nodeId: string, query: AncestorsDto) {
    // Defense: Guard depth limit to prevent recursive explosion
    const safeDepth = Math.min(query.depthLimit, 20);
    return DocumentQueryService.getDescendants(nodeId, safeDepth);
  }

  async expandContext(nodeId: string, query: ExpandContextDto) {
    // Defense: Guard limits
    const safeBefore = Math.min(query.before, 50);
    const safeAfter = Math.min(query.after, 50);
    return DocumentQueryService.expandContext(nodeId, safeBefore, safeAfter);
  }
}
