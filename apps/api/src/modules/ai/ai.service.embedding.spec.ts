jest.mock('@studyai/database', () => ({
  db: {},
  explanations: {},
  eq: jest.fn(),
  and: jest.fn(),
}));

import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService embedding provider contract', () => {
  const apiKey = ['provider', 'test', 'credential'].join('-');
  const embeddingModel = 'openai/text-embedding-3-small';
  const validEmbedding = Array.from({ length: 1536 }, (_, index) => index / 1536);

  function createService(
    baseUrl: string,
    options: {
      apiKey?: string | null;
      embeddingApiKey?: string | null;
      mockMode?: boolean;
    } = {},
  ): AiService {
    const values: Record<string, unknown> = {
      'ai.apiKey': options.apiKey === undefined ? apiKey : options.apiKey,
      'ai.baseUrl': baseUrl,
      'ai.model': 'generation-model',
      'ai.embeddingApiKey': options.embeddingApiKey === undefined
        ? (options.apiKey === undefined ? apiKey : options.apiKey)
        : options.embeddingApiKey,
      'ai.embeddingBaseUrl': baseUrl,
      'ai.embeddingModel': embeddingModel,
      'ai.embeddingMockMode': options.mockMode ?? false,
      'ai.useGeminiSdk': false,
    };
    const config = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
    return new AiService(config);
  }

  function response(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Service Unavailable',
      json: jest.fn().mockResolvedValue(body),
    } as unknown as Response;
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['base ending in /v1', 'https://openrouter.ai/api/v1', 'https://openrouter.ai/api/v1/embeddings'],
    ['trailing slash', 'https://openrouter.ai/api/v1/', 'https://openrouter.ai/api/v1/embeddings'],
    ['base without /v1', 'https://openrouter.ai/api', 'https://openrouter.ai/api/v1/embeddings'],
  ])('normalizes %s without duplicating path segments', async (_case, baseUrl, expectedUrl) => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response({ data: [{ embedding: validEmbedding }] }));

    await createService(baseUrl).getEmbedding('semantic input');

    expect(fetchMock).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
  });

  it('preserves provider headers and sends the configured embedding model', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response({ data: [{ embedding: validEmbedding }] }));

    await createService('https://openrouter.ai/api/v1').getEmbedding('semantic input');

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://studyai.com',
      'X-Title': 'StudyAI',
    });
    expect(JSON.parse(request.body as string)).toEqual({
      model: embeddingModel,
      input: 'semantic input',
      dimensions: 1536,
    });
  });

  it('returns a valid finite 1536-dimensional provider embedding', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(response({ data: [{ embedding: validEmbedding }] }));

    await expect(
      createService('https://openrouter.ai/api/v1').getEmbedding('semantic input'),
    ).resolves.toEqual(validEmbedding);
  });

  it.each([
    ['malformed response', { data: [{ embedding: 'not-an-array' }] }],
    ['empty embedding', { data: [{ embedding: [] }] }],
    ['dimensionally invalid embedding', { data: [{ embedding: [0.1, 0.2] }] }],
    ['non-finite embedding', { data: [{ embedding: [...validEmbedding.slice(0, -1), Number.NaN] }] }],
  ])('rejects a %s', async (_case, body) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response(body));

    await expect(
      createService('https://openrouter.ai/api/v1').getEmbedding('semantic input'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('surfaces a provider HTTP error without substituting a vector', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({}, 503));

    await expect(
      createService('https://openrouter.ai/api/v1').getEmbedding('semantic input'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when production embedding credentials are absent', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    await expect(
      createService('https://openrouter.ai/api/v1', { apiKey: null }).getEmbedding('semantic input'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not misuse a generation-only Gemini credential for OpenRouter embeddings', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    await expect(
      createService('https://openrouter.ai/api/v1', {
        apiKey: 'gemini-generation-only',
        embeddingApiKey: null,
      }).getEmbedding('semantic input'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('permits only explicit mock mode to use a deterministic embedding', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    const service = createService('https://openrouter.ai/api/v1', {
      apiKey: null,
      mockMode: true,
    });

    const first = await service.getEmbedding('repeatable test input');
    const second = await service.getEmbedding('repeatable test input');

    expect(first).toHaveLength(1536);
    expect(second).toEqual(first);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('logs only sanitized provider failure metadata', async () => {
    const sensitiveInput = 'private document content';
    const sensitiveProviderPayload = 'raw provider payload';
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error(`${sensitiveProviderPayload}: ${apiKey}`));

    await expect(
      createService('https://openrouter.ai/api/v1').getEmbedding(sensitiveInput),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    const serializedLogArguments = JSON.stringify(errorLog.mock.calls);
    expect(serializedLogArguments).not.toContain(sensitiveInput);
    expect(serializedLogArguments).not.toContain(sensitiveProviderPayload);
    expect(serializedLogArguments).not.toContain(apiKey);
    expect(errorLog).toHaveBeenCalledWith('Embedding provider request failed', {
      status: undefined,
      errorType: 'Error',
    });
  });
});
