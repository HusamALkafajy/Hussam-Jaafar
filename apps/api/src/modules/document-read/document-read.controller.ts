import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DocumentReadService } from './document-read.service';
import { PaginationDto, AncestorsDto, ExpandContextDto } from './dto/read.dto';

@Controller('documents')
export class DocumentReadController {
  constructor(private readonly readService: DocumentReadService) {}

  @Get('nodes/:id')
  async getNode(@Param('id') id: string) {
    return this.readService.getNode(id);
  }

  @Get('nodes/:id/children')
  async getChildren(
    @Param('id') id: string,
    @Query() query: PaginationDto
  ) {
    // If id is 'root', we pass null to fetch top-level nodes for a document
    const parentId = id === 'root' ? null : id;
    return this.readService.getChildren(parentId, query);
  }

  @Get('nodes/:id/window')
  async getWindow(
    @Param('id') id: string,
    @Query('cursor') cursor: string,
    @Query() query: PaginationDto
  ) {
    const parentId = id === 'root' ? null : id;
    return this.readService.getWindowForParent(parentId, cursor, query);
  }

  @Get('files/:fileId/headings')
  async getHeadingTree(@Param('fileId') fileId: string) {
    return this.readService.getHeadingTree(fileId);
  }

  @Get('nodes/:id/ancestors')
  async getAncestors(@Param('id') id: string) {
    return this.readService.getAncestors(id);
  }

  @Get('nodes/:id/descendants')
  async getDescendants(
    @Param('id') id: string,
    @Query() query: AncestorsDto
  ) {
    return this.readService.getDescendants(id, query);
  }

  @Get('nodes/:id/context')
  async expandContext(
    @Param('id') id: string,
    @Query() query: ExpandContextDto
  ) {
    return this.readService.expandContext(id, query);
  }
}
