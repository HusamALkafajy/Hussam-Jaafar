import { registerAs } from '@nestjs/config';

/** Canonical OpenRouter chat-completions base — never read from env to prevent stale overrides. */
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/** Google Generative Language OpenAI-compat base (text-only fallback when no OpenRouter key). */
const GOOGLE_COMPAT_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';

/** Embedding contract retained by the 1,536-dimension pgvector schema. */
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

export default registerAs('ai', () => {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY || null;
  const geminiApiKey     = process.env.GEMINI_API_KEY     || null;

  const hasOpenRouterKey = !!openRouterApiKey;
  const hasGeminiKey     = !!geminiApiKey;

  // Native Gemini SDK is used ONLY for multimodal (PDF/image) extraction when
  // there is NO OpenRouter key. The SDK correctly handles application/pdf as
  // inlineData — the OpenAI-compat REST layer does not.
  const useGeminiSdk = hasGeminiKey && !hasOpenRouterKey;

  // Base URL priority:
  //   1. OpenRouter key present  → always use OPENROUTER_BASE (hardcoded, not overridable)
  //   2. Only Gemini key present → Google OpenAI-compat endpoint
  //   3. Neither                 → doesn't matter (Mock Mode)
  const baseUrl = hasOpenRouterKey ? OPENROUTER_BASE : GOOGLE_COMPAT_BASE;

  // Primary API key used for Authorization header in callOpenRouter()
  const apiKey = openRouterApiKey ?? geminiApiKey ?? null;

  // Model name:
  //   • OpenRouter expects the provider-prefixed form: 'google/gemini-2.5-flash'
  //   • Google compat endpoint expects the bare model name: 'gemini-2.5-flash'
  const model = hasOpenRouterKey
    ? (process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash')
    : (process.env.GEMINI_MODEL    ?? 'gemini-2.5-flash');

  return {
    apiKey,
    openRouterApiKey,
    geminiApiKey,
    baseUrl,
    model,
    embeddingApiKey: openRouterApiKey,
    embeddingBaseUrl: OPENROUTER_BASE,
    embeddingModel: EMBEDDING_MODEL,
    embeddingMockMode: process.env.NODE_ENV === 'test',
    allowMockDocumentExtraction: process.env.ALLOW_MOCK_DOCUMENT_EXTRACTION === 'true',
    useGeminiSdk,
  };
});



