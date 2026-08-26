import { CallHandler, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { TOKEN_COST_KEY } from '../../common/decorators/token-cost.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { QuotaInterceptor } from '../../common/interceptors/quota.interceptor';

jest.mock('./exams.service', () => ({
  ExamsService: class ExamsService {},
}));

import { ExamsController } from './exams.controller';

describe('ExamsController adaptive free-launch containment', () => {
  const userId = 'user-1';
  const examId = 'exam-1';

  let findById: jest.Mock;
  let generateNextAdaptiveQuestion: jest.Mock;
  let adaptiveProviderCall: jest.Mock;
  let adaptiveQuestionPersistence: jest.Mock;
  let isEnabled: jest.Mock;
  let controller: ExamsController;

  beforeEach(() => {
    findById = jest.fn().mockResolvedValue({ id: examId, userId });
    adaptiveProviderCall = jest.fn().mockResolvedValue({ questionText: 'Future adaptive question' });
    adaptiveQuestionPersistence = jest.fn().mockResolvedValue(undefined);
    generateNextAdaptiveQuestion = jest.fn().mockImplementation(async () => {
      const question = await adaptiveProviderCall();
      await adaptiveQuestionPersistence(question);
      return question;
    });
    isEnabled = jest.fn().mockReturnValue(false);

    controller = new ExamsController(
      {
        findById,
        generateNextAdaptiveQuestion,
      } as any,
      {
        features: { isEnabled },
      } as any,
    );
  });

  it('retains JWT authentication on the controller', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ExamsController) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('returns a deterministic feature-disabled response without invoking adaptive work', async () => {
    let thrown: unknown;

    try {
      await controller.nextAdaptiveQuestion(userId, examId);
    } catch (error) {
      thrown = error;
    }

    expect(findById).toHaveBeenCalledWith(examId, userId);
    expect(isEnabled).toHaveBeenCalledWith('adaptive_exam', { userId });
    expect(thrown).toBeInstanceOf(ForbiddenException);
    expect((thrown as ForbiddenException).getStatus()).toBe(403);
    expect((thrown as ForbiddenException).message).toBe(
      'Adaptive exam questions are disabled for the current release.',
    );
    expect(generateNextAdaptiveQuestion).not.toHaveBeenCalled();
    expect(adaptiveProviderCall).not.toHaveBeenCalled();
    expect(adaptiveQuestionPersistence).not.toHaveBeenCalled();
  });

  it('preserves the owner-scoped not-found response before evaluating the feature flag', async () => {
    const ownerScopedError = new NotFoundException('Exam not found');
    findById.mockRejectedValue(ownerScopedError);

    await expect(controller.nextAdaptiveQuestion(userId, examId)).rejects.toBe(ownerScopedError);
    expect(isEnabled).not.toHaveBeenCalled();
    expect(generateNextAdaptiveQuestion).not.toHaveBeenCalled();
    expect(adaptiveProviderCall).not.toHaveBeenCalled();
    expect(adaptiveQuestionPersistence).not.toHaveBeenCalled();
  });

  it('preserves the existing adaptive service path when the canonical feature flag is enabled', async () => {
    isEnabled.mockReturnValue(true);

    await expect(controller.nextAdaptiveQuestion(userId, examId)).resolves.toEqual({
      questionText: 'Future adaptive question',
    });

    expect(findById).toHaveBeenCalledWith(examId, userId);
    expect(generateNextAdaptiveQuestion).toHaveBeenCalledWith(examId, userId);
    expect(adaptiveProviderCall).toHaveBeenCalledTimes(1);
    expect(adaptiveQuestionPersistence).toHaveBeenCalledTimes(1);
  });

  it('has no TokenCost metadata and performs no quota reservation for the disabled route', async () => {
    const reflector = new Reflector();
    const handler = ExamsController.prototype.nextAdaptiveQuestion;
    const tokenAccountant = {
      reserve: jest.fn(),
      commit: jest.fn(),
      release: jest.fn(),
    };
    const interceptor = new QuotaInterceptor(reflector, tokenAccountant as any);
    const context = {
      getHandler: () => handler,
      getClass: () => ExamsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { sub: userId } }) }),
    } as any;
    const next = { handle: () => of('unmetered') } as CallHandler;

    expect(
      reflector.getAllAndOverride(TOKEN_COST_KEY, [handler, ExamsController]),
    ).toBeUndefined();
    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toBe('unmetered');
    expect(tokenAccountant.reserve).not.toHaveBeenCalled();
    expect(tokenAccountant.commit).not.toHaveBeenCalled();
    expect(tokenAccountant.release).not.toHaveBeenCalled();
  });
});
