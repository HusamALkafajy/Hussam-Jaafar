jest.mock('@studyai/database', () => ({
  db: {
    query: { explanations: { findFirst: jest.fn() } },
    insert: jest.fn(),
  },
  explanations: {},
  eq: jest.fn(),
  and: jest.fn(),
}));

jest.mock('./token-tracking', () => ({ saveTokenUsage: jest.fn() }));
jest.mock('./quota-guard', () => ({ checkQuota: jest.fn() }));

import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { db } from '@studyai/database';
import { AiService } from './ai.service';
import { StructuredLogger } from '../../common/logging/structured-logger';

const canaries = [
  'credential-canary-9f6e',
  'Bearer authorization-canary',
  'https://provider.example/v1/chat?query-canary=1',
  'account-balance-canary',
  'raw-prompt-canary',
  'generated-content-canary',
  'document-content-canary',
  'user-id-canary',
  'provider-body-canary',
  'stack-trace-canary',
];

const providerMessage = canaries.join(' | ');

type ConsoleSpy = jest.SpyInstance<void, [message?: any, ...optionalParams: any[]]>;

function createService(withProvider = true): AiService {
  const config = {
    get: jest.fn((key: string) => (key === 'ai.apiKey' && withProvider ? 'configured-provider-key' : undefined)),
  } as unknown as ConfigService;
  const service = new AiService(config);
  (service as unknown as { logger: StructuredLogger }).logger = new StructuredLogger(true, AiService.name);
  return service;
}

function providerError(status?: number, name = 'Error'): Error & { status?: number } {
  const error = new Error(providerMessage) as Error & { status?: number };
  error.name = name;
  error.stack = `stack-trace-canary ${providerMessage}`;
  if (status !== undefined) error.status = status;
  return error;
}

function parseEntries(spy: ConsoleSpy): Array<Record<string, unknown>> {
  return spy.mock.calls.map(([serialized]) => JSON.parse(String(serialized)) as Record<string, unknown>);
}

function expectNoCanaries(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const canary of canaries) {
    expect(serialized).not.toContain(canary);
  }
}

function captureException(action: () => unknown): InternalServerErrorException {
  try {
    action();
  } catch (error) {
    return error as InternalServerErrorException;
  }
  throw new Error('Expected provider operation to throw');
}

describe('AiService provider-error containment', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let errorOutput: ConsoleSpy;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    errorOutput = jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  const statusCases: Array<[number, string]> = [
    [400, 'provider_request_rejected'],
    [401, 'provider_authentication_failed'],
    [402, 'provider_credit_required'],
    [403, 'provider_authentication_failed'],
    [429, 'provider_rate_limited'],
    [500, 'provider_unavailable'],
    [502, 'provider_unavailable'],
    [503, 'provider_unavailable'],
  ];

  it.each(statusCases)('maps HTTP %i to a bounded %s reason', (status, reason) => {
    const service = createService();
    const exception = captureException(() =>
      (service as unknown as {
        throwProviderOperationFailure: (operation: string, error: unknown) => never;
      }).throwProviderOperationFailure('summary', providerError(status)),
    );

    expect(exception).toBeInstanceOf(InternalServerErrorException);
    expect(exception.getResponse()).toEqual({
      message: 'Summary generation failed.',
      code: reason,
    });

    const [entry] = parseEntries(errorOutput);
    expect(entry.message).toBe('ai_provider_failure');
    expect(entry.context).toEqual([
      {
        event: 'ai_provider_failure',
        provider: 'openrouter',
        operation: 'summary',
        reason,
        status,
      },
    ]);
    expectNoCanaries([entry, exception.getResponse()]);
  });

  it('maps timeout and unknown failures without using provider message text', () => {
    const service = createService();
    const timeout = captureException(() =>
      (service as unknown as {
        throwProviderOperationFailure: (operation: string, error: unknown) => never;
      }).throwProviderOperationFailure('chat', providerError(undefined, 'AbortError')),
    );
    const unknown = captureException(() =>
      (service as unknown as {
        throwProviderOperationFailure: (operation: string, error: unknown) => never;
      }).throwProviderOperationFailure('chat', providerError()),
    );

    expect(timeout.getResponse()).toEqual({
      message: 'Document chat generation failed.',
      code: 'provider_timeout',
    });
    expect(unknown.getResponse()).toEqual({
      message: 'Document chat generation failed.',
      code: 'provider_failure',
    });

    const entries = parseEntries(errorOutput);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => (entry.context as Array<{ reason: string }>)[0].reason)).toEqual([
      'provider_timeout',
      'provider_failure',
    ]);
    expectNoCanaries([entries, timeout.getResponse(), unknown.getResponse()]);
  });

  it('classifies malformed provider responses without retaining response material', async () => {
    const service = createService();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ choices: [{ message: { content: '' } }] }),
    } as unknown as Response);

    await expect(
      (service as unknown as {
        callOpenRouter: (messages: Array<{ role: string; content: string }>, jsonMode: boolean) => Promise<string>;
      }).callOpenRouter([], true),
    ).rejects.toMatchObject({
      reason: 'provider_response_invalid',
      message: 'provider_response_invalid',
    });
  });

  it('contains streaming HTTP failures without logging provider response bodies', async () => {
    const service = createService();
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 402 } as Response);

    const streamError = await new Promise<unknown>((resolve) => {
      service.callOpenRouterStream([{ role: 'user', content: providerMessage }], undefined, 'summary').subscribe({
        error: resolve,
      });
    });

    expect(streamError).toMatchObject({ reason: 'provider_credit_required', status: 402 });
    const [entry] = parseEntries(errorOutput);
    expect(entry.context).toEqual([
      {
        event: 'ai_provider_failure',
        provider: 'openrouter',
        operation: 'summary',
        reason: 'provider_credit_required',
        status: 402,
      },
    ]);
    expectNoCanaries([entry, streamError]);
  });

  it.each([
    ['summary', 'generateSummary', ['document-content-canary', 'college', 'en'], 'Summary generation failed.'],
    ['explain', 'generateExplanation', ['document-content-canary', 'college', 'en'], 'Explanation generation failed.'],
    ['chat', 'chatWithDocument', ['document-content-canary', 'raw-prompt-canary', []], 'Document chat generation failed.'],
    ['flashcards', 'generateFlashcards', ['document-content-canary', 3], 'Flashcard generation failed.'],
    ['exam', 'generateExam', ['document-content-canary', 'medium', ['mcq'], 3], 'Exam generation failed.'],
  ] as const)('contains provider failures for %s', async (operation, method, args, message) => {
    const service = createService();
    jest.spyOn(service as any, 'callOpenRouter').mockRejectedValue(providerError(402));

    await expect((service as any)[method](...args)).rejects.toMatchObject({
      response: {
        message,
        code: 'provider_credit_required',
      },
    });

    const [entry] = parseEntries(errorOutput);
    expect(entry.context).toEqual([
      {
        event: 'ai_provider_failure',
        provider: 'openrouter',
        operation,
        reason: 'provider_credit_required',
        status: 402,
      },
    ]);
    expectNoCanaries(entry);
  });

  it('does not persist explanations after a provider failure', async () => {
    const service = createService();
    (db.query.explanations.findFirst as jest.Mock).mockResolvedValue(undefined);
    const insert = db.insert as jest.Mock;
    jest.spyOn(service as any, 'callOpenRouter').mockRejectedValue(providerError(402));

    await expect(
      service.generateExplanation('document-content-canary', 'college', 'en', 'file-canary', 'user-id-canary'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(insert).not.toHaveBeenCalled();
    expectNoCanaries([parseEntries(errorOutput), insert.mock.calls]);
  });

  it('preserves successful provider behavior', async () => {
    const service = createService();
    jest.spyOn(service as any, 'callOpenRouter').mockResolvedValue('{"content":"safe result"}');

    await expect(service.generateSummary('document', 'college', 'en')).resolves.toEqual({ content: 'safe result' });
    expect(errorOutput).not.toHaveBeenCalled();
  });

  it('preserves honest mock mode without provider transport', async () => {
    const service = createService(false);
    const providerCall = jest.spyOn(service as any, 'callOpenRouter');

    await expect(service.generateSummary('document', 'college', 'en')).resolves.toEqual(
      expect.objectContaining({ content: expect.any(String) }),
    );
    expect(providerCall).not.toHaveBeenCalled();
    expect(errorOutput).not.toHaveBeenCalled();
  });
});
