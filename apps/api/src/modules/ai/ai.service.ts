import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { requestContext } from '../../common/request-context';
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
   * 4 096 tokens ≈ 3 000 words — sufficient for summaries, explanations, exams,
   * flashcards, and chat replies. Raise only for the exam generator if needed.
   */
  private static readonly OPENROUTER_MAX_TOKENS = 2048;

  /** Set when GEMINI_API_KEY is present and OPENROUTER_API_KEY is NOT.
   *  Used exclusively for multimodal (PDF / image) extraction via the
   *  native @google/generative-ai SDK, which correctly handles
   *  application/pdf inlineData — the OpenAI-compat endpoint does not. */
  private geminiClient: GoogleGenerativeAI | null = null;
  private geminiModel: string = 'gemini-2.5-flash';

  constructor(private readonly configService: ConfigService) {
    this.apiKey       = this.configService.get<string>('ai.apiKey')  || null;
    // ai.config.ts now stores the FULL base URL including /v1
    // e.g. 'https://openrouter.ai/api/v1'  — callOpenRouter appends only '/chat/completions'
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
      this.logger.log(
        `[AiService] PROVIDER=GeminiSDK  model=${this.geminiModel}  ` +
        '(PDF/image → @google/generative-ai inlineData; text calls → Google compat REST)',
      );
    } else if (this.apiKey) {
      this.logger.log(
        `[AiService] PROVIDER=OpenRouter  endpoint=${this.baseUrl}/chat/completions  model=${this.defaultModel}`,
      );
    } else {
      this.logger.warn(
        '[AiService] PROVIDER=MockMode — no API key found. ' +
        'Set OPENROUTER_API_KEY (preferred) or GEMINI_API_KEY in apps/api/.env.',
      );
    }
  }

  private isMockMode(): boolean {
    return !this.apiKey || this.apiKey.includes('mock');
  }

  /** True when the native Gemini SDK should handle multimodal calls. */
  private isGeminiSdkMode(): boolean {
    return this.geminiClient !== null;
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

  private async runWithRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 1000): Promise<T> {
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const errorMsg = String(error.message || error).toLowerCase();
        const statusCode = error.status || error.statusCode || error.status_code || 0;

        const isRetryable =
          statusCode === 503 ||
          statusCode === 429 ||
          errorMsg.includes('503') ||
          errorMsg.includes('429') ||
          errorMsg.includes('service unavailable') ||
          errorMsg.includes('resource exhausted') ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('quota') ||
          errorMsg.includes('high demand') ||
          errorMsg.includes('overloaded');

        if (isRetryable && attempt < maxRetries) {
          this.logger.warn(
            `OpenRouter API returned retryable error (attempt ${attempt}/${maxRetries}): ${error.message || error}. Retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw error;
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
      // Explicit token cap — prevents OpenRouter from defaulting to the model's
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
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errorMsg = res.statusText;
        try {
          const errorJson = await res.json();
          errorMsg = errorJson?.error?.message || JSON.stringify(errorJson);
        } catch (e) {}
        throw new Error(`OpenRouter API call failed (HTTP ${res.status}): ${errorMsg}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Invalid or empty response from OpenRouter API');
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
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

    // ── Path A: Native Gemini SDK (GEMINI_API_KEY set, no OPENROUTER_API_KEY) ──
    // The Gemini SDK correctly handles application/pdf via inlineData.
    // The OpenAI-compat REST endpoint does NOT support PDF as image_url.
    if (this.isGeminiSdkMode()) {
      return this.extractTextWithGeminiSdk(filePath, mimeType);
    }

    // ── Path B: OpenRouter REST endpoint (image_url format) ──
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
   * - temperature 0 → deterministic, factual output (less likely to recite)
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
    'DO NOT copy text verbatim — instead paraphrase, reorganise, and extract key concepts, ' +
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
    this.logger.log(
      `[Gemini SDK] Reading file ${filePath} (${mimeType}) for native SDK processing...`,
    );

    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');

    const inlinePart = { inlineData: { mimeType, data: base64Data } };

    // ── Helper: build a configured GenerativeModel ────────────────────────
    const buildModel = (modelName: string): GenerativeModel =>
      this.geminiClient!.getGenerativeModel({
        model: modelName,
        systemInstruction: EXTRACTION_SYSTEM_PROMPT,
        safetySettings: this.geminiSafetySettings,
        generationConfig: this.geminiExtractionConfig,
      });

    // ── Attempt 1: primary model, anti-recitation prompt ──────────────────
    try {
      this.logger.log(
        `[Gemini SDK] Attempt 1 — model "${this.geminiModel}" with anti-recitation prompt...`,
      );

      const result = await this.runWithRetry(() =>
        buildModel(this.geminiModel).generateContent([
          inlinePart,
          { text: this.extractionUserPrompt },
        ]),
      );

      const candidate = result.response.candidates?.[0];
      const finishReason = candidate?.finishReason;

      if (finishReason === 'RECITATION') {
        // Do NOT throw yet — fall through to Attempt 2.
        this.logger.warn(
          `[Gemini SDK] RECITATION block on primary model "${this.geminiModel}". ` +
          `Falling back to "${this.recitationFallbackModel}" with stricter paraphrase prompt...`,
        );
      } else {
        const text = result.response.text();
        if (!text) {
          throw new Error(
            `Gemini SDK returned empty text (finishReason: ${finishReason ?? 'unknown'}).`,
          );
        }
        this.logger.log(`[Gemini SDK] Attempt 1 successful for ${filePath}.`);
        return text;
      }
    } catch (err: any) {
      // Only rethrow non-RECITATION errors from attempt 1 — RECITATION
      // is handled by falling through to attempt 2 (already logged above).
      if (!err?.message?.includes('RECITATION')) {
        this.logger.error('[Gemini SDK] Attempt 1 failed with non-RECITATION error:', err);
        throw new InternalServerErrorException(
          `Gemini SDK text extraction failed: ${err.message}`,
        );
      }
      this.logger.warn(
        `[Gemini SDK] Caught RECITATION in attempt 1 error: ${err.message}`,
      );
    }

    // ── Attempt 2: fallback model + even stricter prompt ──────────────────
    // gemini-1.5-flash / gemini-1.5-pro apply a different training-data
    // attribution heuristic and are less likely to trigger RECITATION on
    // the same content than gemini-2.5-flash.
    try {
      this.logger.log(
        `[Gemini SDK] Attempt 2 — fallback model "${this.recitationFallbackModel}"...`,
      );

      const stricterPrompt =
        'You are a document analyser. Your task is to restructure and reformat the attached ' +
        'document into organised Markdown. IMPORTANT: do not quote or reproduce any sentence ' +
        'verbatim — summarise every passage in your own words, reorganise the structure, ' +
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
        // Both attempts blocked — return a graceful degradation payload so
        // the file is marked COMPLETED (not stuck in PROCESSING) and the
        // user sees a useful message instead of a spinner forever.
        this.logger.error(
          `[Gemini SDK] RECITATION persisted on fallback model for ${filePath}. ` +
          'Returning degradation notice so file is marked COMPLETED.',
        );
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

      this.logger.log(
        `[Gemini SDK] Attempt 2 successful for ${filePath} using fallback model.`,
      );
      return text;
    } catch (error: any) {
      this.logger.error('[Gemini SDK] Attempt 2 (fallback) failed:', error);
      throw new InternalServerErrorException(
        `Gemini SDK text extraction failed after all retries: ${error.message}`,
      );
    }
  }

  /**
   * Extracts text using the OpenRouter REST endpoint (OpenAI vision message
   * format with image_url). Used when OPENROUTER_API_KEY is set.
   */
  private async extractTextWithOpenRouter(filePath: string, mimeType: string): Promise<string> {
    try {
      this.logger.log(
        `[OpenRouter] Reading file ${filePath} (${mimeType}) for REST processing...`,
      );
      const fileBuffer = await fs.readFile(filePath);
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      this.logger.log(`[OpenRouter] Analyzing file using model ${this.defaultModel}...`);

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
    } catch (error: any) {
      this.logger.error('[OpenRouter] extractText failed:', error);
      throw new InternalServerErrorException(
        `OpenRouter API text extraction failed: ${error.message}`,
      );
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
    } catch (error: any) {
      this.logger.error('Error in getCompletion:', error);
      throw new InternalServerErrorException(`AI completion failed: ${error.message}`);
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
      const messages = [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: getSummaryUserPrompt(text, level, language) }
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: any) {
      this.logger.error('Error in generateSummary:', error);
      throw new InternalServerErrorException(`Summary generation failed: ${error.message}`);
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
            // Invalid escape (e.g. \*, \_) — drop the backslash, emit the literal char
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

    // 4. Parse — throws SyntaxError naturally if still malformed
    try {
      return JSON.parse(result) as T;
    } catch (error) {
      this.logger.error('AI response JSON parsing failed', error, {
        responseLength: raw.length,
      });
      throw new Error('Explanation generation failed: The AI response was too long and got truncated. Please try again with a shorter section.');
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

    // ── 1. DB cache lookup ────────────────────────────────────────────────────
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
          this.logger.log(
            `[generateExplanation] Cache HIT — fileId=${fileId} level=${level} lang=${language}`,
          );
          return {
            content: cached.content,
            examples: cached.examples ?? [],
            comprehensionQuestions: cached.comprehensionQuestions ?? [],
          };
        }

        this.logger.log(
          `[generateExplanation] Cache MISS — calling OpenRouter for fileId=${fileId}`,
        );
      } catch (cacheErr: any) {
        // Non-fatal: log and continue to generate fresh
        this.logger.warn(`[generateExplanation] Cache lookup failed: ${cacheErr.message}`);
      }
    }

    // ── 2. Build messages ─────────────────────────────────────────────────────
    const userPrompt = getExplanationUserPrompt(text, level, language);

    this.logger.log(
      `[generateExplanation] Sending request — ` +
      `fileId=${fileId ?? 'n/a'}, level=${level}, lang=${language}, contentLen=${text?.length ?? 0}`,
    );

    const messages = [
      { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt },
    ];

    // ── 3. Call OpenRouter with json_object mode + retry ──────────────────────
    let parsed: any;
    try {
      const responseText = await this.runWithRetry(() =>
        this.callOpenRouter(messages, /* jsonMode= */ true),
      );

      this.logger.debug(
        `[generateExplanation] Raw OpenRouter response length: ${responseText?.length}`,
      );

      parsed = this.sanitizeAndParseJson(responseText);
    } catch (error: any) {
      this.logger.error('[generateExplanation] OpenRouter call or JSON parse failed:', error);
      throw new InternalServerErrorException(`Explanation generation failed: ${error.message}`);
    }

    // ── 4. Persist to DB (non-fatal) ──────────────────────────────────────────
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
        this.logger.log(`[generateExplanation] Explanation persisted for fileId=${fileId}`);
      } catch (dbErr: any) {
        // Non-fatal: caller still receives the freshly-generated result
        this.logger.warn(`[generateExplanation] DB insert failed (non-fatal): ${dbErr.message}`);
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
      const messages = [
        { role: 'system', content: EXAM_SYSTEM_PROMPT },
        { role: 'user', content: getExamUserPrompt(text, difficulty, types, count) }
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true, 15 * 60 * 1000));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: any) {
      this.logger.error('Error in generateExam:', error);
      throw new InternalServerErrorException(`Exam generation failed: ${error.message}`);
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
      const messages = [
        { role: 'system', content: FLASHCARD_SYSTEM_PROMPT },
        { role: 'user', content: getFlashcardUserPrompt(text, count) }
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: any) {
      this.logger.error('Error in generateFlashcards:', error);
      throw new InternalServerErrorException(`Flashcards generation failed: ${error.message}`);
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
        { role: 'system', content: `${CHAT_SYSTEM_PROMPT}\n\nDocument Content:\n${text}` },
        ...formattedHistory,
        { role: 'user', content: getChatUserPrompt(question) }
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: any) {
      this.logger.error('Error in chatWithDocument:', error);
      throw new InternalServerErrorException(`Document Q&A failed: ${error.message}`);
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
        { role: 'system', content: `${PEDAGOGICAL_TUTOR_SYSTEM_PROMPT}\n\n${contextText}` },
        ...formattedHistory,
        { role: 'user', content: question }
      ];

      // Tutor uses standard text output, not JSON, because it needs to generate rich Markdown text
      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, false));
      return responseText;
    } catch (error: any) {
      this.logger.error('Error in chatWithTutor:', error);
      throw new InternalServerErrorException(`Pedagogical Tutor Q&A failed: ${error.message}`);
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
      const userPrompt = getExamFeedbackUserPrompt(results, ragContext, score);
      const messages = [
        { role: 'system', content: ADAPTIVE_EXAM_FEEDBACK_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ];

      const responseText = await this.runWithRetry(() =>
        this.callOpenRouter(messages, true, 15 * 60 * 1000),
      );
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: any) {
      this.logger.error('Error in generateExamFeedback:', error);
      throw new InternalServerErrorException(`Exam feedback generation failed: ${error.message}`);
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
      const userPrompt = getAdaptiveQuestionUserPrompt(weakTopics, context, existingQuestionTexts);
      const messages = [
        { role: 'system', content: ADAPTIVE_QUESTION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: any) {
      this.logger.error('Error in generateAdaptiveQuestion:', error);
      throw new InternalServerErrorException(`Adaptive question generation failed: ${error.message}`);
    }
  }

  // ── Smart Notes AI methods ──────────────────────────────────────────────

  /**
   * Generates a 2-3 sentence concise summary of a user's note content.
   * Called only on explicit "Analyze" button click — never on auto-save.
   */
  async generateNoteSummary(content: string): Promise<{ summary: string }> {
    if (this.isMockMode()) {
      return { summary: 'هذا ملخص تجريبي للملاحظة. يتضمن النقاط الرئيسية التي دوّنها الطالب لمراجعة سريعة.' };
    }

    const systemPrompt = `You are an expert educational AI. Read the note and generate a concise summary.
CRITICAL RULE: The output language MUST exactly match the dominant language of the input note (if the note is in English, output in English; if Arabic, output in Arabic).
Return JSON: { "summary": "..." }`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Note content:\n\n${content}` },
      ];
      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: any) {
      this.logger.error('Error in generateNoteSummary:', error);
      throw new InternalServerErrorException(`Note summary generation failed: ${error.message}`);
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
        { question: 'ما هو الموضوع الرئيسي في هذه الملاحظة؟', answer: 'الموضوع المدوّن في الملاحظة', type: 'short' },
        { question: 'أيٌّ من التالي ذكره الطالب في ملاحظاته؟', answer: 'النقطة الأولى', type: 'mcq' },
      ];
    }

    const systemPrompt = `You are an expert educational AI. Read the note and generate up to 5 quiz questions. Mix MCQ and short-answer types.
CRITICAL RULE: The output language MUST exactly match the dominant language of the input note (if the note is in English, output in English; if Arabic, output in Arabic).
Return JSON array: [{ "question": "...", "answer": "...", "type": "mcq" | "short" }]`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Note content:\n\n${content}` },
      ];
      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      const parsed = JSON.parse(this.cleanJson(responseText));
      // Handle both { questions: [...] } and direct array responses
      return Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
    } catch (error: any) {
      this.logger.error('Error in generateNoteQuizQuestions:', error);
      throw new InternalServerErrorException(`Note quiz generation failed: ${error.message}`);
    }
  }
}

