import { registerAs } from '@nestjs/config';

export default registerAs('ai', () => {
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  let defaultBaseUrl = 'https://openrouter.ai/api';
  if (!hasOpenRouterKey && hasGeminiKey) {
    defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
  }

  return {
    apiKey: process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY,
    baseUrl: process.env.OPENROUTER_BASE_URL || defaultBaseUrl,
    model:
      process.env.OPENROUTER_MODEL ||
      process.env.GEMINI_MODEL ||
      (hasOpenRouterKey ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash'),
  };
});

