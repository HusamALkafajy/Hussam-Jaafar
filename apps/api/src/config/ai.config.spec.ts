import aiConfig from './ai.config';

describe('AI embedding configuration', () => {
  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('binds the OpenRouter embedding contract to the OpenRouter credential', () => {
    const credential = ['openrouter', 'config', 'sentinel'].join('-');
    process.env.NODE_ENV = 'production';
    process.env.OPENROUTER_API_KEY = credential;
    delete process.env.GEMINI_API_KEY;

    const config = aiConfig();

    expect(config).toEqual(
      expect.objectContaining({
        embeddingApiKey: credential,
        embeddingBaseUrl: 'https://openrouter.ai/api/v1',
        embeddingModel: 'openai/text-embedding-3-small',
        embeddingMockMode: false,
      }),
    );
  });

  it('enables deterministic embedding mocks only in the explicit test environment', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GEMINI_API_KEY;

    expect(aiConfig()).toEqual(
      expect.objectContaining({
        embeddingApiKey: null,
        embeddingMockMode: true,
      }),
    );
  });
});
