import { Test, TestingModule } from '@nestjs/testing';
import { DocumentReadController } from '../document-read.controller';
import { DocumentReadService } from '../document-read.service';
import { DocumentQueryService } from '@studyai/database';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

jest.mock('@studyai/database', () => ({
  DocumentQueryService: {
    getNode: jest.fn(),
    getChildren: jest.fn(),
    getWindow: jest.fn(),
    getAncestors: jest.fn(),
    getDescendants: jest.fn(),
    expandContext: jest.fn()
  },
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([])
  },
  eq: jest.fn(),
  files: {},
  documentVersions: {}
}));

describe('DocumentReadController', () => {
  let controller: DocumentReadController;
  let service: DocumentReadService;
  const mockUserId = 'user-1';
  const mockVersionId = 'version-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentReadController],
      providers: [
        DocumentReadService
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => true
    })
    .compile();

    controller = module.get<DocumentReadController>(DocumentReadController);
    service = module.get<DocumentReadService>(DocumentReadService);

    // Mock resolveActiveReadableVersion and validateReadableVersion to always resolve
    jest.spyOn(service, 'resolveActiveReadableVersion').mockResolvedValue({
      fileId: 'file-1',
      versionId: mockVersionId,
      status: 'completed'
    });
    jest.spyOn(service, 'validateReadableVersion').mockResolvedValue({
      fileId: 'file-1',
      versionId: mockVersionId,
      status: 'completed'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AST queries', () => {
    it('getNode should call readService.getNode with userId and versionId', async () => {
      const mockResult = { data: { id: '123' }, diagnostics: {} };
      (DocumentQueryService.getNode as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getNode(mockUserId, mockVersionId, '123');
      expect(result).toBe(mockResult);
      expect(DocumentQueryService.getNode).toHaveBeenCalledWith(mockVersionId, '123');
    });

    it('getDescendants should call getDescendants with depth limit', async () => {
      const mockResult = { data: [], diagnostics: {} };
      (DocumentQueryService.getDescendants as jest.Mock).mockResolvedValue(mockResult);

      await controller.getDescendants(mockUserId, mockVersionId, '123', { depthLimit: 20 });
      expect(DocumentQueryService.getDescendants).toHaveBeenCalledWith(mockVersionId, '123', 20);
    });

    it('expandContext should call expandContext with before/after', async () => {
      const mockResult = { data: [], diagnostics: {} };
      (DocumentQueryService.expandContext as jest.Mock).mockResolvedValue(mockResult);

      await controller.expandContext(mockUserId, mockVersionId, '123', { before: 50, after: 50 });
      expect(DocumentQueryService.expandContext).toHaveBeenCalledWith(mockVersionId, '123', 50, 50);
    });
  });
});
