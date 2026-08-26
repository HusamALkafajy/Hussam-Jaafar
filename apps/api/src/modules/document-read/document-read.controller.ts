import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { DocumentReadService } from './document-read.service';
import { PaginationDto, AncestorsDto, ExpandContextDto } from './dto/read.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentReadController {
  constructor(private readonly readService: DocumentReadService) {}

  @Get('files/:fileId/bootstrap')
  async bootstrap(
    @CurrentUser('sub') userId: string,
    @Param('fileId') fileId: string
  ) {
    return this.readService.bootstrap(userId, fileId);
  }

  @Get('versions/:versionId/nodes/:id')
  async getNode(
    @CurrentUser('sub') userId: string,
    @Param('versionId') versionId: string,
    @Param('id') id: string
  ) {
    return this.readService.getNode(userId, versionId, id);
  }

  @Get('versions/:versionId/nodes/:id/children')
  async getChildren(
    @CurrentUser('sub') userId: string,
    @Param('versionId') versionId: string,
    @Param('id') id: string,
    @Query() query: PaginationDto
  ) {
    const parentId = id === 'root' ? null : id;
    return this.readService.getChildren(userId, versionId, parentId, query);
  }

  @Get('versions/:versionId/nodes/:id/window')
  async getWindow(
    @CurrentUser('sub') userId: string,
    @Param('versionId') versionId: string,
    @Param('id') id: string,
    @Query('cursor') cursor: string,
    @Query() query: PaginationDto
  ) {
    const parentId = id === 'root' ? null : id;
    return this.readService.getWindowForParent(userId, versionId, parentId, cursor, query);
  }

  @Get('versions/:versionId/headings')
  async getHeadingTree(
    @CurrentUser('sub') userId: string,
    @Param('versionId') versionId: string
  ) {
    return this.readService.getHeadingTree(userId, versionId);
  }

  @Get('versions/:versionId/nodes/:id/ancestors')
  async getAncestors(
    @CurrentUser('sub') userId: string,
    @Param('versionId') versionId: string,
    @Param('id') id: string
  ) {
    return this.readService.getAncestors(userId, versionId, id);
  }

  @Get('versions/:versionId/nodes/:id/descendants')
  async getDescendants(
    @CurrentUser('sub') userId: string,
    @Param('versionId') versionId: string,
    @Param('id') id: string,
    @Query() query: AncestorsDto
  ) {
    return this.readService.getDescendants(userId, versionId, id, query);
  }

  @Get('versions/:versionId/nodes/:id/context')
  async expandContext(
    @CurrentUser('sub') userId: string,
    @Param('versionId') versionId: string,
    @Param('id') id: string,
    @Query() query: ExpandContextDto
  ) {
    return this.readService.expandContext(userId, versionId, id, query);
  }
}
