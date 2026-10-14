import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException, MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { requestContext } from '../../common/request-context';
import { saveTokenUsage } from './token-tracking';
import { checkQuota } from './quota-guard';
import { db, explanations, eq, and } from '@studyai/database';
import { EXTRACTION_SYSTEM_PROMPT } from './prompts/extraction.prompts';
import { SUMMARY_SYSTEM_PROMPT, getSummaryUserPrompt } from './prompts/summary.prompts';
import { getExplanationUserPrompt } from './prompts/explanation.prompts';
import { EXAM_SYSTEM_PROMPT, getExamUserPrompt } from './prompts/exam.prompts';
import { FLASHCARD_SYSTEM_PROMPT, getFlashcardUserPrompt } from './prompts/flashcard.prompts';
import { CHAT_SYSTEM_PROMPT, getChatUserPrompt } from './prompts/chat.prompts';
import {
  ADAPTIVE_EXAM_FEEDBACK_SYSTEM_PROMPT,
  getExamFeedbackUserPrompt,
  ADAPTIVE_QUESTION_SYSTEM_PROMPT,
  getAdaptiveQuestionUserPrompt,
} from './prompts/adaptive-exam.prompts';
import { PEDAGOGICAL_TUTOR_SYSTEM_PROMPT } from './prompts/tutor.prompts';
import * as fs from 'fs/promises';

/**
 * Strict system prompt for the explanation feature.
 * Sent to OpenRouter (google/gemini-2.5-flash) via the OpenAI-compat chat completions endpoint.
 * Enforces PURE JSON output with no markdown fences, no prose outside the object.
 */
const EXPLANATION_SYSTEM_PROMPT =
  'You are an expert AI tutor. Explain the provided study material at the requested level.\n' +
  'Include practical examples and generate 3-5 comprehension questions.\n\n' +
  'CRITICAL OUTPUT RULES - YOU MUST FOLLOW THESE WITHOUT EXCEPTION:\n' +
  '1. You MUST return ONLY valid JSON without any markdown formatting.\n' +
  '2. Do NOT wrap your response in code fences (```json or ```).\n' +
  '3. Do NOT include any text before or after the JSON object.\n' +
  '4. All string values inside the JSON must use \\n for newlines, not literal newlines.\n' +
  '5. Do NOT use backslash escapes like \\* or \\_ inside string values.\n' +
  '6. CRITICAL: You are strictly limited in length. Keep the explanation highly concise and focused. You MUST properly close the JSON object before stopping. Do not output more than 1000 words to ensure the JSON is not truncated.\n\n' +
  'Return a JSON object matching EXACTLY this schema:\n' +
  '{\n' +
  '  "content": "<main explanation as a single string>",\n' +
  '  "examples": ["<example 1>", "<example 2>"],\n' +
  '  "comprehensionQuestions": [\n' +
  '    { "question": "<question text>", "answer": "<answer text>" }\n' +
  '  ]\n' +
  '}\n\n' +
  'Ensure the language of all values matches the requested language (Arabic or English).';


type ProviderFailureReason =
  | 'provider_authentication_failed'
  | 'provider_credit_required'
  | 'provider_rate_limited'
  | 'provider_request_rejected'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'provider_response_invalid'
  | 'provider_failure';

type ProviderOperation =
  | 'summary'
  | 'explain'
  | 'chat'
  | 'flashcards'
  | 'exam'
  | 'extraction'
  | 'completion'
  | 'stream';

type ProviderName = 'openrouter' | 'gemini';

class ProviderFailureError extends Error {
  constructor(
    readonly reason: ProviderFailureReason,
    readonly status?: number,
  ) {
    super(reason);
    this.name = 'ProviderFailureError';
  }
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private apiKey: string | null = null;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private defaultModel = 'google/gemini-2.5-flash';
  private embeddingApiKey: string | null = null;
  private embeddingBaseUrl = 'https://openrouter.ai/api/v1';
  private embeddingModel = 'openai/text-embedding-3-small';
  private embeddingMockMode = false;

  private static readonly EMBEDDING_DIMENSIONS = 1536;

  /**
   * Hard cap on output tokens sent with every OpenRouter request.
   *
   * Without this field OpenRouter defaults to the model's maximum context window
   * (gemini-2.5-flash = 65 535 output tokens), which exhausts per-request credit
   * budgets and returns HTTP 402 Payment Required.
   *
   * 4 096 tokens â‰ˆ 3 000 words â€” sufficient for summaries, explanations, exams,
   * flashcards, and chat replies. Raise only for the exam generator if needed.
   */
  private static readonly OPENROUTER_MAX_TOKENS = 2048;

  /** Set when GEMINI_API_KEY is present and OPENROUTER_API_KEY is NOT.
   *  Used exclusively for multimodal (PDF / image) extraction via the
   *  native @google/generative-ai SDK, which correctly handles
   *  application/pdf inlineData â€” the OpenAI-compat endpoint does not. */
  private geminiClient: GoogleGenerativeAI | null = null;
  private geminiModel: string = 'gemini-2.5-flash';

  constructor(private readonly configService: ConfigService) {
    this.apiKey       = this.configService.get<string>('ai.apiKey')  || null;
    // ai.config.ts now stores the FULL base URL including /v1
    // e.g. 'https://openrouter.ai/api/v1'  â€” callOpenRouter appends only '/chat/completions'
    this.baseUrl      = this.configService.get<string>('ai.baseUrl') || 'https://openrouter.ai/api/v1';
    this.defaultModel = this.configService.get<string>('ai.model')   || 'google/gemini-2.5-flash';
    this.embeddingApiKey = this.configService.get<string>('ai.embeddingApiKey') || null;
    this.embeddingBaseUrl = this.configService.get<string>('ai.embeddingBaseUrl') || 'https://openrouter.ai/api/v1';
    this.embeddingModel = this.configService.get<string>('ai.embeddingModel') || 'openai/text-embedding-3-small';
    this.embeddingMockMode = this.configService.get<boolean>('ai.embeddingMockMode') === true;

    const useGeminiSdk = this.configService.get<boolean>('ai.useGeminiSdk');
    const geminiApiKey = this.configService.get<string>('ai.geminiApiKey');

    if (useGeminiSdk && geminiApiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiApiKey);
      this.geminiModel  = this.defaultModel;
      this.logger.log('ai_provider_configured', {
        event: 'ai_provider_configured',
        provider: 'gemini',
      });
    } else if (this.apiKey) {
      this.logger.log('ai_provider_configured', {
        event: 'ai_provider_configured',
        provider: 'openrouter',
      });
    } else {
      this.logger.warn('ai_provider_mock_mode', {
        event: 'ai_provider_mock_mode',
      });
    }
  }

  private isMockMode(): boolean {
    return !this.apiKey || this.apiKey.includes('mock');
  }

  /** True when the native Gemini SDK should handle multimodal calls. */
  private isGeminiSdkMode(): boolean {
    return this.geminiClient !== null;
  }

  /**
   * Truncates document content to a safe character limit to prevent HTTP 402
   * "Prompt tokens limit exceeded" errors on OpenRouter free-tier accounts.
   *
   * Rationale:  1 token ≈ 4 characters.
   *   • MAX_CHARS = 30,000  →  ~7,500 tokens of document context
   *   • Free-tier observed limit: ~14,197 prompt tokens
   *   • System prompt + user-prompt wrapper: ~500–2,000 tokens overhead
   *   • This leaves a comfortable margin for all generation methods.
   *
   * The truncation notice appended to the content is intentionally visible to
   * the AI so it knows the source material was cut, preventing hallucinations.
   */
  private static readonly MAX_CONTENT_CHARS = 30_000;
  private truncateContent(text: string, label = 'content'): string {
    if (!text || text.length <= AiService.MAX_CONTENT_CHARS) return text;
    this.logger.warn(
      `[AiService] truncateContent: ${label} (${text.length} chars) exceeds limit — truncating to ${AiService.MAX_CONTENT_CHARS} chars.`,
    );
    return text.slice(0, AiService.MAX_CONTENT_CHARS) + '\n\n...[Content truncated due to token limits]';
  }


  private cleanJson(text: string): string {
    if (!text) return '{}';
    let cleaned = text.trim();

    // Strip markdown code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');

    // Extract JSON object
    const match = /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(cleaned);
    if (match) cleaned = match[0];

    // Use a character-by-character parser to fix bad escapes inside strings
    let result = '';
    let inString = false;
    let i = 0;

    while (i < cleaned.length) {
      const char = cleaned[i];

      if (char === '"' && cleaned[i - 1] !== '\\') {
        inString = !inString;
        result += char;
        i++;
        continue;
      }

      if (inString && char === '\\') {
        // Check the next character
        const nextChar = cleaned[i + 1];
        const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'];
        if (nextChar && !validEscapes.includes(nextChar)) {
          // It's an invalid escape sequence (like \* or \_), so drop the backslash
          i++;
          continue;
        }
      }

      if (inString && char === '\n') {
        result += '\\n';
        i++;
        continue;
      }

      if (inString && char === '\r') {
        result += '\\r';
        i++;
        continue;
      }

      result += char;
      i++;
    }

    return result;
  }

  private getTrustedProviderStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;

    const candidate = error as Record<string, unknown>;
    for (const key of ['status', 'statusCode', 'status_code']) {
      const value = candidate[key];
      if (typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599) {
        return value;
      }
    }

    return undefined;
  }

  private classifyProviderFailure(error: unknown): ProviderFailureError {
    if (error instanceof ProviderFailureError) return error;

    const status = this.getTrustedProviderStatus(error);
    const errorName =
      error && typeof error === 'object' && typeof (error as { name?: unknown }).name === 'string'
        ? (error as { name: string }).name
        : undefined;

    if (errorName === 'AbortError' || errorName === 'TimeoutError') {
      return new ProviderFailureError('provider_timeout', status);
    }

    switch (status) {
      case 401:
      case 403:
        return new ProviderFailureError('provider_authentication_failed', status);
      case 402:
        return new ProviderFailureError('provider_credit_required', status);
      case 429:
        return new ProviderFailureError('provider_rate_limited', status);
      case 400:
        return new ProviderFailureError('provider_request_rejected', status);
      case 500:
      case 502:
      case 503:
        return new ProviderFailureError('provider_unavailable', status);
      default:
        return new ProviderFailureError('provider_failure', status);
    }
  }

  private logProviderFailure(
    operation: ProviderOperation,
    error: unknown,
    provider: ProviderName = 'openrouter',
    retryCount?: number,
  ): ProviderFailureError {
    const failure = this.classifyProviderFailure(error);
    this.logger.error('ai_provider_failure', {
      event: 'ai_provider_failure',
      provider,
      operation,
      reason: failure.reason,
      ...(failure.status !== undefined ? { status: failure.status } : {}),
      ...(retryCount !== undefined ? { retryCount } : {}),
    });
    return failure;
  }

  private throwProviderOperationFailure(
    operation: ProviderOperation,
    error: unknown,
    provider: ProviderName = 'openrouter',
  ): never {
    const failure = this.logProviderFailure(operation, error, provider);
    const messages: Record<ProviderOperation, string> = {
      summary: 'Summary generation failed.',
      explain: 'Explanation generation failed.',
      chat: 'Document chat generation failed.',
      flashcards: 'Flashcard generation failed.',
      exam: 'Exam generation failed.',
      extraction: 'Document text extraction failed.',
      completion: 'AI completion failed.',
      stream: 'AI stream generation failed.',
    };

    throw new InternalServerErrorException({
      message: messages[operation],
      code: failure.reason,
    });
  }

  private async runWithRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 1000): Promise<T> {
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        const failure = this.classifyProviderFailure(error);
        const isRetryable = failure.status === 503 || failure.status === 429;

        if (isRetryable && attempt < maxRetries) {
          this.logger.warn('ai_provider_retry', {
            event: 'ai_provider_retry',
            reason: failure.reason,
            status: failure.status,
            retryCount: attempt,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw failure;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  private async callOpenRouter(
    messages: Array<{ role: string; content: any }>,
    jsonMode = false,
    timeoutMs = 10 * 60 * 1000,
    maxTokensOverride?: number,
  ): Promise<string> {
    // this.baseUrl already contains /v1 (set by ai.config.ts), so append only the path.
    const url = `${this.baseUrl}/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://studyai.com',
      'X-Title': 'StudyAI',
    };

    const body: any = {
      model: this.defaultModel,
      messages,
      // Explicit token cap â€” prevents OpenRouter from defaulting to the model's
      // maximum context window (65 535 for gemini-2.5-flash) and triggering 402.
      max_tokens: maxTokensOverride ?? AiService.OPENROUTER_MAX_TOKENS,
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    // Bypass timeouts for ADMIN users by setting timeout to 24 hours
    const store = requestContext.getStore();
    const isAdmin = store?.user?.role === 'ADMIN';
    const finalTimeoutMs = isAdmin ? 24 * 60 * 60 * 1000 : timeoutMs;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), finalTimeoutMs);


    try {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        throw this.classifyProviderFailure(error);
      }

      if (!res.ok) {
        throw this.classifyProviderFailure({ status: res.status });
      }

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new ProviderFailureError('provider_response_invalid');
      }

      const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })
        ?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content) {
        throw new ProviderFailureError('provider_response_invalid');
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public callOpenRouterStream(
    messages: Array<{ role: string; content: any }>,
    maxTokensOverride?: number,
    operation: ProviderOperation = 'stream',
  ): Observable<MessageEvent> {
    const store = requestContext.getStore();
    const userId = (store?.user as any)?.id;

    // Sanitize baseUrl — strip any trailing slash to avoid double-slash in URL construction
    const sanitizedBaseUrl = this.baseUrl.replace(/\/$/, '');
    const url = `${sanitizedBaseUrl}/chat/completions`;

    return new Observable((subscriber) => {
      if (userId) {
        checkQuota(userId).catch(err => subscriber.error(err));
      }

      if (!this.apiKey) {
        const failure = new ProviderFailureError('provider_failure');
        this.logProviderFailure(operation, failure);
        subscriber.error(failure);
        return;
      }

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://studyai.com',
        'X-Title': 'StudyAI',
      };

      const body = {
        model: this.defaultModel,
        messages,
        max_tokens: maxTokensOverride ?? AiService.OPENROUTER_MAX_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
      };

      const controller = new AbortController();

      this.logger.debug('ai_provider_request_started', {
        event: 'ai_provider_request_started',
        provider: 'openrouter',
        operation,
      });

      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const failure = this.logProviderFailure(operation, { status: res.status });
            subscriber.error(failure);
            return;
          }

          if (!res.body) {
            const failure = this.logProviderFailure(
              operation,
              new ProviderFailureError('provider_response_invalid'),
            );
            subscriber.error(failure);
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          const read = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  const trimmedLine = line.trim();
                  if (trimmedLine.startsWith('data: ')) {
                    const data = trimmedLine.slice(6);
                    if (data === '[DONE]') {
                      subscriber.next({ data: JSON.stringify({ done: true }) } as MessageEvent);
                      continue;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.usage && userId) saveTokenUsage(userId, 'stream_call', parsed.usage.prompt_tokens || 0, parsed.usage.completion_tokens || 0, this.defaultModel).catch(() => {});
                      const content = parsed.choices?.[0]?.delta?.content;
                      if (content) {
                        subscriber.next({ data: JSON.stringify({ content }) } as MessageEvent);
                      }
                    } catch (e) {
                      // ignore parse error on incomplete chunks
                    }
                  }
                }
              }
              subscriber.complete();
            } catch (error) {
              const failure = this.logProviderFailure(operation, error);
              subscriber.error(failure);
            }
          };
          read();
        })
        .catch((error: unknown) => {
          const failure = this.logProviderFailure(operation, error);
          subscriber.error(failure);
        });

      return () => {
        controller.abort();
      };
    });
  }

  generateSummaryStream(text: string, level: string, language: string): Observable<MessageEvent> {
    const safeText = this.truncateContent(text, 'summary stream text');
    const messages = [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: getSummaryUserPrompt(safeText, level, language) + '\n\nNOTE: Please provide the response in plain text or markdown, not JSON, so it can be streamed.' }
    ];
    return this.callOpenRouterStream(messages, undefined, 'summary');
  }

  chatWithDocumentStream(text: string, question: string, history: any[]): Observable<MessageEvent> {
    const formattedHistory = history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));
    const messages = [
      { role: 'system', content: `\n\nDocument Content:\n${this.truncateContent(text, 'chat stream document')}` },
      ...formattedHistory,
      { role: 'user', content: getChatUserPrompt(question) + '\n\nNOTE: Please provide the response in plain text or markdown, not JSON, so it can be streamed.' }
    ];
    return this.callOpenRouterStream(messages, undefined, 'chat');
  }

  async getEmbedding(text: string): Promise<number[]> {
    const store = requestContext.getStore();
    const userId = (store?.user as any)?.id;
    if (userId) await checkQuota(userId);

    if (this.embeddingMockMode) {
      return this.createDeterministicEmbedding(text);
    }

    if (!this.embeddingApiKey) {
      this.logger.error('Embedding provider is not configured');
      throw new ServiceUnavailableException('Embedding provider is not configured');
    }

    let providerStatus: number | undefined;
    try {
      const url = this.buildEmbeddingUrl();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.embeddingApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://studyai.com',
          'X-Title': 'StudyAI',
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: text,
          dimensions: AiService.EMBEDDING_DIMENSIONS,
        }),
      });
      providerStatus = res.status;

      if (!res.ok) {
        throw new Error('Embedding provider returned an unsuccessful response');
      }

      const data = await res.json();
      const embedding = data?.data?.[0]?.embedding;
      if (
        !Array.isArray(embedding) ||
        embedding.length !== AiService.EMBEDDING_DIMENSIONS ||
        !embedding.every((value: unknown) => typeof value === 'number' && Number.isFinite(value))
      ) {
        throw new Error('Embedding provider returned an invalid vector');
      }

      return embedding;
    } catch (error) {
      this.logger.error('Embedding provider request failed', {
        status: providerStatus,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new ServiceUnavailableException('Embedding provider request failed');
    }
  }

  private buildEmbeddingUrl(): string {
    const url = new URL(this.embeddingBaseUrl.trim());
    const basePath = url.pathname.replace(/\/+$/, '');
    const hasVersionedOpenAiPath = /\/v\d+(?:beta\d*)?(?:\/openai)?$/i.test(basePath);

    url.pathname = `${basePath}${hasVersionedOpenAiPath ? '' : '/v1'}/embeddings`;
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  private createDeterministicEmbedding(text: string): number[] {
    const vector = new Array(AiService.EMBEDDING_DIMENSIONS).fill(0);
    for (let index = 0; index < text.length; index++) {
      vector[index % AiService.EMBEDDING_DIMENSIONS] += text.charCodeAt(index);
    }
    const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / length);
  }

  async extractText(filePath: string, mimeType: string): Promise<string> {
    if (this.isMockMode()) {
      const isTestEnvironment = this.configService.get<string>('app.nodeEnv') === 'test';
      const mockExtractionAllowed = this.configService.get<boolean>('ai.allowMockDocumentExtraction') === true;
      if (!isTestEnvironment || !mockExtractionAllowed) {
        throw new ServiceUnavailableException(
          'Document extraction requires a configured provider for this file type.',
        );
      }

      // This branch exists solely for isolated automated tests. It must never
      // become a persisted user-document result.
      return 'TEST_ONLY_DOCUMENT_EXTRACTION';
    }

    // â”€â”€ Path A: Native Gemini SDK (GEMINI_API_KEY set, no OPENROUTER_API_KEY) â”€â”€
    // The Gemini SDK correctly handles application/pdf via inlineData.
    // The OpenAI-compat REST endpoint does NOT support PDF as image_url.
    if (this.isGeminiSdkMode()) {
      return this.extractTextWithGeminiSdk(filePath, mimeType);
    }

    // â”€â”€ Path B: OpenRouter REST endpoint (image_url format) â”€â”€
    // Works for images (jpeg, png, webp). For PDFs this path requires the
    // underlying model to support PDF via the OpenAI vision message format,
    // which not all OpenRouter-routed models do. If you are using OpenRouter
    // with a model that does NOT support PDF natively, switch to GEMINI_API_KEY.
    return this.extractTextWithOpenRouter(filePath, mimeType);
  }

  /**
   * Safety settings applied to every Gemini SDK call.
   * All categories are set to BLOCK_NONE so academic/technical document
   * content (chemistry, medicine, law, history) is never falsely blocked.
   * The Gemini API itself still applies platform-level policy regardless.
   */
  private readonly geminiSafetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ];

  /**
   * Generation config for document extraction via the native Gemini SDK:
   * - temperature 0 â†’ deterministic, factual output (less likely to recite)
   * - maxOutputTokens aligned with OPENROUTER_MAX_TOKENS for cost consistency
   * - topP / topK tightened to reduce hallucinated verbatim passages
   */
  private readonly geminiExtractionConfig = {
    temperature: 0,
    topP: 0.8,
    topK: 20,
    maxOutputTokens: 8192, // Increased exclusively for PDF extraction to handle large documents natively
  };

  /**
   * Extraction prompt engineered to minimise RECITATION finish_reason.
   * RECITATION is triggered when the model detects it is about to reproduce
   * content that matches its training data verbatim. By explicitly asking
   * for paraphrase + structured reformatting, we shift the output style
   * away from verbatim reproduction while preserving all factual content.
   */
  private readonly extractionUserPrompt =
    'Analyse this document and produce a structured Markdown summary. ' +
    'DO NOT copy text verbatim â€” instead paraphrase, reorganise, and extract key concepts, ' +
    'headings, tables, formulas, and lists into clean Markdown. ' +
    'Preserve all factual information faithfully but express it in your own words.';

  /** Fallback model used when the primary model returns a RECITATION block. */
  private readonly recitationFallbackModel = 'gemini-1.5-flash';

  /**
   * Uses the official @google/generative-ai SDK to extract text from a
   * PDF or image file. Sends the raw file bytes as inlineData.
   *
   * Handles RECITATION finish_reason by retrying once with:
   *   1. An even more paraphrase-focused prompt variant.
   *   2. The gemini-1.5-flash fallback model (handles copyright triggers differently).
   */
  private async extractTextWithGeminiSdk(filePath: string, mimeType: string): Promise<string> {
    this.logger.log('ai_provider_request_started', {
      event: 'ai_provider_request_started',
      provider: 'gemini',
      operation: 'extraction',
    });

    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');

    const inlinePart = { inlineData: { mimeType, data: base64Data } };

    // â”€â”€ Helper: build a configured GenerativeModel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const buildModel = (modelName: string): GenerativeModel =>
      this.geminiClient!.getGenerativeModel({
        model: modelName,
        systemInstruction: EXTRACTION_SYSTEM_PROMPT,
        safetySettings: this.geminiSafetySettings,
        generationConfig: this.geminiExtractionConfig,
      });

    // â”€â”€ Attempt 1: primary model, anti-recitation prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      this.logger.debug('ai_provider_attempt_started', {
        event: 'ai_provider_attempt_started',
        provider: 'gemini',
        operation: 'extraction',
        retryCount: 0,
      });

      const result = await this.runWithRetry(() =>
        buildModel(this.geminiModel).generateContent([
          inlinePart,
          { text: this.extractionUserPrompt },
        ]),
      );

      const store = requestContext.getStore();
      const userId = (store?.user as any)?.id;
      const usage = result.response.usageMetadata;
      if (usage && userId) {
        saveTokenUsage(userId, 'extraction', usage.promptTokenCount || 0, usage.candidatesTokenCount || 0, this.geminiModel).catch(() => {});
      }

      const candidate = result.response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason === 'RECITATION') {
        // Do NOT throw yet â€” fall through to Attempt 2.
        this.logger.warn('ai_provider_fallback', {
          event: 'ai_provider_fallback',
          provider: 'gemini',
          operation: 'extraction',
          reason: 'provider_request_rejected',
        });
      } else {
        const text = result.response.text();
        if (!text) {
          throw new Error(
            `Gemini SDK returned empty text (finishReason: ${finishReason ?? 'unknown'}).`,
          );
        }
        this.logger.log('ai_provider_request_completed', {
          event: 'ai_provider_request_completed',
          provider: 'gemini',
          operation: 'extraction',
        });
        return text;
      }
    } catch (err: any) {
      // Only rethrow non-RECITATION errors from attempt 1 â€” RECITATION
      // is handled by falling through to attempt 2 (already logged above).
      this.throwProviderOperationFailure('extraction', err, 'gemini');
    }

    // â”€â”€ Attempt 2: fallback model + even stricter prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // gemini-1.5-flash / gemini-1.5-pro apply a different training-data
    // attribution heuristic and are less likely to trigger RECITATION on
    // the same content than gemini-2.5-flash.
    try {
      this.logger.debug('ai_provider_attempt_started', {
        event: 'ai_provider_attempt_started',
        provider: 'gemini',
        operation: 'extraction',
        retryCount: 1,
      });

      const stricterPrompt =
        'You are a document analyser. Your task is to restructure and reformat the attached ' +
        'document into organised Markdown. IMPORTANT: do not quote or reproduce any sentence ' +
        'verbatim â€” summarise every passage in your own words, reorganise the structure, ' +
        'and extract only key concepts, data, formulas, and section headings.';

      const result = await this.runWithRetry(() =>
        buildModel(this.recitationFallbackModel).generateContent([
          inlinePart,
          { text: stricterPrompt },
        ]),
      );

      const candidate = result.response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason === 'RECITATION') {
        // Both attempts blocked â€” return a graceful degradation payload so
        // the file is marked COMPLETED (not stuck in PROCESSING) and the
        // user sees a useful message instead of a spinner forever.
        this.logger.error('ai_provider_degradation', {
          event: 'ai_provider_degradation',
          provider: 'gemini',
          operation: 'extraction',
          reason: 'provider_request_rejected',
        });
        return (
          '> **Note:** The AI was unable to extract the full text of this document due to ' +
          'content recitation restrictions. You can still use the document for Chat and Exam ' +
          'generation by uploading a version with different formatting, or by using a Word (.docx) ' +
          'version which bypasses this restriction entirely.'
        );
      }

      const text = result.response.text();
      if (!text) {
        throw new Error(
          `Gemini SDK fallback model returned empty text (finishReason: ${finishReason ?? 'unknown'}).`,
        );
      }

      this.logger.log('ai_provider_request_completed', {
        event: 'ai_provider_request_completed',
        provider: 'gemini',
        operation: 'extraction',
      });
      return text;
    } catch (error: unknown) {
      this.throwProviderOperationFailure('extraction', error, 'gemini');
    }
  }

  /**
   * Extracts text using the OpenRouter REST endpoint (OpenAI vision message
   * format with image_url). Used when OPENROUTER_API_KEY is set.
   */
  private async extractTextWithOpenRouter(filePath: string, mimeType: string): Promise<string> {
    try {
      this.logger.log('ai_provider_request_started', {
        event: 'ai_provider_request_started',
        provider: 'openrouter',
        operation: 'extraction',
      });
      const fileBuffer = await fs.readFile(filePath);
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      this.logger.debug('ai_provider_request_dispatched', {
        event: 'ai_provider_request_dispatched',
        provider: 'openrouter',
        operation: 'extraction',
      });

      const messages = [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract and format the contents of this document in clean Markdown.',
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, false, 10 * 60 * 1000, 8192));
      return responseText;
    } catch (error: unknown) {
      this.throwProviderOperationFailure('extraction', error);
    }
  }

  async getCompletion(prompt: string, systemPrompt?: string, jsonMode = false): Promise<string> {
    if (this.isMockMode()) {
      return jsonMode ? '{}' : 'This is a mock completion from the AI Service.';
    }
    try {
      const messages: Array<{ role: string; content: any }> = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });
      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, jsonMode));
      return jsonMode ? this.cleanJson(responseText) : responseText;
    } catch (error: unknown) {
      this.throwProviderOperationFailure('completion', error);
    }
  }

  async generateSummary(text: string, level: string, language: string): Promise<any> {
    if (this.isMockMode()) {
      return {
        content: `This is a mock summary of the document at ${level} level in ${language}. It highlights the core learning materials and key takeaways for student study sessions.`,
        keyPoints: ['First key take-away from the study material.', 'Second concept worth highlighting.', 'Third learning point.'],
        definitions: [{ term: 'SaaS', definition: 'Software as a Service - delivery model for applications.' }],
        lawsFormulas: [{ name: 'Einstein Mass-Energy', formula: 'E = mc^2', explanation: 'Relates mass and energy.' }],
      };
    }

    try {
      const safeText = this.truncateContent(text, 'summary text');
      const messages = [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: getSummaryUserPrompt(safeText, level, language) }
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: unknown) {
      this.throwProviderOperationFailure('summary', error);
    }
  }

  /**
   * Robust JSON extractor + sanitizer.
   *
   * Strips markdown code fences, extracts the first JSON object/array, then
   * walks the raw string character-by-character to fix invalid escape sequences
   * (e.g. \* or \_ produced by LLMs when they embed markdown inside JSON strings)
   * and to ensure bare newlines/tabs inside strings are properly escaped.
   *
   * Use this instead of cleanJson() anywhere the AI response may contain rich text.
   */
  private sanitizeAndParseJson<T = any>(raw: string): T {
    if (!raw) throw new SyntaxError('Empty response from AI');

    // 1. Strip markdown code fences
    let text = raw.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    // 2. Extract outermost JSON object or array
    const match = /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(text);
    if (match) text = match[0];

    // 3. Character-by-character escape fixer
    const VALID_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
    let result = '';
    let inString = false;
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      // Toggle string mode on unescaped double-quotes
      if (ch === '"' && (i === 0 || text[i - 1] !== '\\')) {
        inString = !inString;
        result += ch;
        i++;
        continue;
      }

      if (inString) {
        if (ch === '\\') {
          const next = text[i + 1];
          if (next && !VALID_ESCAPES.has(next)) {
            // Invalid escape (e.g. \*, \_) â€” drop the backslash, emit the literal char
            i++;
            continue;
          }
        } else if (ch === '\n') {
          result += '\\n';
          i++;
          continue;
        } else if (ch === '\r') {
          result += '\\r';
          i++;
          continue;
        } else if (ch === '\t') {
          result += '\\t';
          i++;
          continue;
        }
      }

      result += ch;
      i++;
    }

    // 4. Parse â€” throws SyntaxError naturally if still malformed
    try {
      return JSON.parse(result) as T;
    } catch {
      throw new ProviderFailureError('provider_response_invalid');
    }
  }

  async generateExplanation(
    text: string,
    level: string,
    language: string,
    fileId?: string,
    userId?: string,
  ): Promise<any> {
    if (this.isMockMode()) {
      return {
        content: `This is a mock explanation of the document at ${level} level in ${language}. It simplifies complex concepts and teaches them like a human tutor.`,
        examples: ['Example demonstrating the first key concept in daily life.', 'Practical application case study.'],
        comprehensionQuestions: [
          { question: 'What is the primary topic discussed in the text?', answer: 'The text primarily covers educational software.' },
          { question: 'Explain how these concepts apply to standard learning.', answer: 'It guides learners systematically.' },
        ],
      };
    }

    // â”€â”€ 1. DB cache lookup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (fileId && userId) {
      try {
        const cached = await db.query.explanations.findFirst({
          where: and(
            eq(explanations.fileId, fileId),
            eq(explanations.userId, userId),
            eq(explanations.level, level as any),
            eq(explanations.language, language),
          ),
        });

        if (cached) {
          this.logger.log('ai_explanation_cache_hit', {
            event: 'ai_explanation_cache_hit',
            operation: 'explain',
          });
          return {
            content: cached.content,
            examples: cached.examples ?? [],
            comprehensionQuestions: cached.comprehensionQuestions ?? [],
          };
        }

        this.logger.log('ai_explanation_cache_miss', {
          event: 'ai_explanation_cache_miss',
          operation: 'explain',
        });
      } catch {
        this.logger.warn('ai_explanation_cache_unavailable', {
          event: 'ai_explanation_cache_unavailable',
          operation: 'explain',
        });
      }
    }

    // â”€â”€ 2. Build messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const safeText = this.truncateContent(text, 'explanation text');
    const userPrompt = getExplanationUserPrompt(safeText, level, language);

    this.logger.debug('ai_provider_request_prepared', {
      event: 'ai_provider_request_prepared',
      provider: 'openrouter',
      operation: 'explain',
    });

    const messages = [
      { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ];

    // â”€â”€ 3. Call OpenRouter with json_object mode + retry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let parsed: any;
    try {
      const responseText = await this.runWithRetry(() =>
        this.callOpenRouter(messages, /* jsonMode= */ true),
      );

      this.logger.debug('ai_provider_response_received', {
        event: 'ai_provider_response_received',
        provider: 'openrouter',
        operation: 'explain',
      });

      parsed = this.sanitizeAndParseJson(responseText);
    } catch (error: unknown) {
      this.throwProviderOperationFailure('explain', error);
    }

    // â”€â”€ 4. Persist to DB (non-fatal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (fileId && userId) {
      try {
        await db.insert(explanations).values({
          fileId,
          userId,
          level: level as any,
          language,
          content: parsed.content ?? '',
          examples: parsed.examples ?? [],
          comprehensionQuestions: parsed.comprehensionQuestions ?? [],
        });
        this.logger.log('ai_explanation_persisted', {
          event: 'ai_explanation_persisted',
          operation: 'explain',
        });
      } catch {
        this.logger.warn('ai_explanation_persistence_unavailable', {
          event: 'ai_explanation_persistence_unavailable',
          operation: 'explain',
        });
      }
    }

    return parsed;
  }


  async generateExam(text: string, difficulty: string, types: string[], count: number): Promise<any> {
    if (this.isMockMode()) {
      return {
        title: 'Mock Learning Assessment',
        questions: Array.from({ length: count }, (_, index) => {
          const questionNumber = index + 1;
          return {
            type: 'mcq',
            questionText: `Mock multiple-choice question ${questionNumber}`,
            options: ['StudyAI', `Alternative ${questionNumber}`],
            correctAnswer: 'StudyAI',
            explanation: `Mock explanation ${questionNumber}`,
            difficulty:
              difficulty === 'mixed'
                ? ['easy', 'medium', 'hard'][index % 3]
                : difficulty,
            points: 1,
          };
        }),
      };
    }

    try {
      const safeText = this.truncateContent(text, 'exam text');
      const messages = [
        { role: 'system', content: EXAM_SYSTEM_PROMPT },
        { role: 'user', content: getExamUserPrompt(safeText, difficulty, types, count) }
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true, 15 * 60 * 1000));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: unknown) {
      this.throwProviderOperationFailure('exam', error);
    }
  }

  async generateFlashcards(text: string, count: number): Promise<any> {
    if (this.isMockMode()) {
      return {
        title: 'Mock Retention Cards',
        cards: [
          { front: 'Concept of Spaced Repetition', back: 'Reviewing information at increasing intervals.' },
          { front: 'Gemini Flash model', back: 'Highly optimized, low latency, and cost-effective AI model.' },
        ],
      };
    }

    try {
      const safeText = this.truncateContent(text, 'flashcards text');
      const messages = [
        { role: 'system', content: FLASHCARD_SYSTEM_PROMPT },
        { role: 'user', content: getFlashcardUserPrompt(safeText, count) }
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: unknown) {
      this.throwProviderOperationFailure('flashcards', error);
    }
  }

  async chatWithDocument(text: string, question: string, history: any[]): Promise<any> {
    if (this.isMockMode()) {
      return {
        content: `This is a mock response to your question: "${question}". I am replying based on the mock text content.`,
        references: [{ page: 1, text: 'This is mock extracted text content' }],
      };
    }

    try {
      const formattedHistory = history.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      const messages = [
        { role: 'system', content: `${CHAT_SYSTEM_PROMPT}\n\nDocument Content:\n${this.truncateContent(text, 'chat document')}` },
        ...formattedHistory,
        { role: 'user', content: getChatUserPrompt(question) }
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: unknown) {
      this.throwProviderOperationFailure('chat', error);
    }
  }

  async chatWithTutor(contextText: string, question: string, history: any[]): Promise<string> {
    if (this.isMockMode()) {
      return `This is a mock response from the Pedagogical Tutor to your question: "${question}". I am replying based on the mock pedagogical context.`;
    }

    try {
      const formattedHistory = history.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      const messages = [
        { role: 'system', content: `${PEDAGOGICAL_TUTOR_SYSTEM_PROMPT}\n\n${this.truncateContent(contextText, 'tutor context')}` },
        ...formattedHistory,
        { role: 'user', content: question }
      ];

      // Tutor uses standard text output, not JSON, because it needs to generate rich Markdown text
      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, false));
      return responseText;
    } catch (error: unknown) {
      this.throwProviderOperationFailure('chat', error);
    }
  }

  /**
   * Generates structured, personalized post-exam feedback.
   * Includes strength/weakness analysis, a study plan, and per-question mini-lessons.
   * For essay/short-answer questions, the AI scores them properly instead of using a heuristic.
   */
  async generateExamFeedback(
    results: Array<{
      questionId: string;
      questionText: string;
      questionType: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
      points: number;
    }>,
    ragContext: string,
    score: number,
  ): Promise<any> {
    if (this.isMockMode()) {
      return {
        strengthAnalysis: {
          topics: ['Core Concepts', 'Definitions'],
          description: 'You demonstrated solid understanding of the fundamental concepts covered in the document.',
        },
        weaknessAnalysis: {
          topics: ['Advanced Applications', 'Formulas'],
          weakTopics: ['Advanced Applications', 'Formulas'],
          description: 'You need more practice with applying concepts to complex scenarios and remembering specific formulas.',
        },
        studyPlan: {
          steps: [
            'Re-read sections covering advanced applications.',
            'Create flashcards for all formulas and definitions.',
            'Retake this quiz after reviewing the weak areas.',
          ],
          recommendations: [
            'Study in 25-minute focused sessions (Pomodoro technique).',
            'Test yourself with flashcards twice daily.',
          ],
        },
        perQuestionFeedback: results.map((r) => ({
          questionId: r.questionId,
          feedback: r.isCorrect
            ? 'Great job! Your answer was correct.'
            : `Your answer "${r.userAnswer}" was incorrect. The correct answer is "${r.correctAnswer}".`,
          miniLesson: r.isCorrect
            ? 'Keep reinforcing this concept through practice.'
            : `Let's revisit this topic: the correct answer relates to the core principles discussed in the document. Review the relevant section and try to connect the concept to real-world examples.`,
        })),
      };
    }

    try {
      const safeRagContext = this.truncateContent(ragContext, 'exam feedback context');
      const userPrompt = getExamFeedbackUserPrompt(results, safeRagContext, score);
      const messages = [
        { role: 'system', content: ADAPTIVE_EXAM_FEEDBACK_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ];

      const responseText = await this.runWithRetry(() =>
        this.callOpenRouter(messages, true, 15 * 60 * 1000),
      );
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: unknown) {
      this.throwProviderOperationFailure('exam', error);
    }
  }

  /**
   * Generates a single adaptive follow-up question targeting a student's identified weak topics.
   * Avoids repeating questions the student has already been asked.
   */
  async generateAdaptiveQuestion(
    weakTopics: string[],
    context: string,
    existingQuestionTexts: string[],
  ): Promise<any> {
    if (this.isMockMode()) {
      return {
        type: 'mcq',
        questionText: `Which of the following best describes the concept of: "${weakTopics[0] || 'the main topic'}"?`,
        options: ['Option A - Correct definition', 'Option B - Incorrect', 'Option C - Incorrect', 'Option D - Incorrect'],
        correctAnswer: 'Option A - Correct definition',
        explanation: 'This is a mock adaptive question targeting your identified weak area.',
        difficulty: 'medium',
        points: 1,
      };
    }

    try {
      const safeContext = this.truncateContent(context, 'adaptive question context');
      const userPrompt = getAdaptiveQuestionUserPrompt(weakTopics, safeContext, existingQuestionTexts);
      const messages = [
        { role: 'system', content: ADAPTIVE_QUESTION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: unknown) {
      this.throwProviderOperationFailure('exam', error);
    }
  }

  // â”€â”€ Smart Notes AI methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Generates a 2-3 sentence concise summary of a user's note content.
   * Called only on explicit "Analyze" button click â€” never on auto-save.
   */
  async generateNoteSummary(content: string): Promise<{ summary: string }> {
    if (this.isMockMode()) {
      return { summary: 'Ù‡Ø°Ø§ Ù…Ù„Ø®Øµ ØªØ¬Ø±ÙŠØ¨ÙŠ Ù„Ù„Ù…Ù„Ø§Ø­Ø¸Ø©. ÙŠØªØ¶Ù…Ù† Ø§Ù„Ù†Ù‚Ø§Ø· Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ø§Ù„ØªÙŠ Ø¯ÙˆÙ‘Ù†Ù‡Ø§ Ø§Ù„Ø·Ø§Ù„Ø¨ Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© Ø³Ø±ÙŠØ¹Ø©.' };
    }

    const systemPrompt = `You are an expert educational AI. Read the note and generate a concise summary.
CRITICAL RULE: The output language MUST exactly match the dominant language of the input note (if the note is in English, output in English; if Arabic, output in Arabic).
Return JSON: { "summary": "..." }`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Note content:\n\n${this.truncateContent(content, 'note summary content')}` },
      ];
      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: unknown) {
      this.throwProviderOperationFailure('summary', error);
    }
  }

  /**
   * Generates up to 5 quiz questions from a user's note content.
   * Returns a mix of MCQ and short-answer questions.
   * Called only on explicit "Analyze" button click.
   */
  async generateNoteQuizQuestions(content: string): Promise<Array<{ question: string; answer: string; type: 'mcq' | 'short' }>> {
    if (this.isMockMode()) {
      return [
        { question: 'Ù…Ø§ Ù‡Ùˆ Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø©ØŸ', answer: 'Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹ Ø§Ù„Ù…Ø¯ÙˆÙ‘Ù† ÙÙŠ Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø©', type: 'short' },
        { question: 'Ø£ÙŠÙŒÙ‘ Ù…Ù† Ø§Ù„ØªØ§Ù„ÙŠ Ø°ÙƒØ±Ù‡ Ø§Ù„Ø·Ø§Ù„Ø¨ ÙÙŠ Ù…Ù„Ø§Ø­Ø¸Ø§ØªÙ‡ØŸ', answer: 'Ø§Ù„Ù†Ù‚Ø·Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰', type: 'mcq' },
      ];
    }

    const systemPrompt = `You are an expert educational AI. Read the note and generate up to 5 quiz questions. Mix MCQ and short-answer types.
CRITICAL RULE: The output language MUST exactly match the dominant language of the input note (if the note is in English, output in English; if Arabic, output in Arabic).
Return JSON array: [{ "question": "...", "answer": "...", "type": "mcq" | "short" }]`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Note content:\n\n${this.truncateContent(content, 'note quiz content')}` },
      ];
      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      const parsed = JSON.parse(this.cleanJson(responseText));
      // Handle both { questions: [...] } and direct array responses
      return Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
    } catch (error: unknown) {
      this.throwProviderOperationFailure('exam', error);
    }
  }
}




