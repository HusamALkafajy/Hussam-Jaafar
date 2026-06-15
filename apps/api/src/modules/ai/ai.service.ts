import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EXTRACTION_SYSTEM_PROMPT } from './prompts/extraction.prompts';
import { SUMMARY_SYSTEM_PROMPT, getSummaryUserPrompt } from './prompts/summary.prompts';
import { EXPLANATION_SYSTEM_PROMPT, getExplanationUserPrompt } from './prompts/explanation.prompts';
import { EXAM_SYSTEM_PROMPT, getExamUserPrompt } from './prompts/exam.prompts';
import { FLASHCARD_SYSTEM_PROMPT, getFlashcardUserPrompt } from './prompts/flashcard.prompts';
import { CHAT_SYSTEM_PROMPT, getChatUserPrompt } from './prompts/chat.prompts';
import * as fs from 'fs/promises';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private apiKey: string | null = null;
  private baseUrl = 'https://openrouter.ai/api';
  private defaultModel = 'google/gemini-2.5-flash';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ai.apiKey') || null;
    this.baseUrl = this.configService.get<string>('ai.baseUrl') || 'https://openrouter.ai/api';
    this.defaultModel = this.configService.get<string>('ai.model') || 'google/gemini-2.5-flash';

    if (!this.apiKey) {
      this.logger.warn('OPENROUTER_API_KEY / GEMINI_API_KEY is not set. AI features will run in Mock Mode.');
    }
  }

  private isMockMode(): boolean {
    return !this.apiKey;
  }

  private cleanJson(text: string): string {
    if (!text) return '{}';
    let cleaned = text.trim();
    
    // Strip markdown code block wrappers if they exist
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/i, '');
      cleaned = cleaned.replace(/\n?```$/, '');
    }
    
    cleaned = cleaned.trim();
    
    // If it still doesn't start with { or [, try to find the first { or [ and last } or ]
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      const firstBrace = cleaned.indexOf('{');
      const firstBracket = cleaned.indexOf('[');
      let startIndex = -1;
      let endIndex = -1;
      
      if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIndex = firstBrace;
        endIndex = cleaned.lastIndexOf('}');
      } else if (firstBracket !== -1) {
        startIndex = firstBracket;
        endIndex = cleaned.lastIndexOf(']');
      }
      
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        cleaned = cleaned.substring(startIndex, endIndex + 1);
      }
    }
    
    return cleaned;
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
  ): Promise<string> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://studyai.com',
      'X-Title': 'StudyAI',
    };

    const body: any = {
      model: this.defaultModel,
      messages,
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
    if (this.isMockMode()) {
      // Return a pseudo-random 1536 dimensions vector
      const vec = new Array(1536).fill(0).map(() => Math.random() - 0.5);
      // L2 normalize
      const len = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
      return vec.map((v) => v / len);
    }

    try {
      const url = `${this.baseUrl}/v1/embeddings`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!res.ok) {
        throw new Error(`Embedding API failed: ${res.statusText}`);
      }

      const data = await res.json();
      return data?.data?.[0]?.embedding || new Array(1536).fill(0);
    } catch (err) {
      this.logger.warn('Failed to call embedding API, using deterministic pseudo-embedding:', err);
      // Generate a deterministic pseudo-embedding based on character codes
      const vec = new Array(1536).fill(0);
      for (let i = 0; i < text.length; i++) {
        vec[i % 1536] += text.charCodeAt(i);
      }
      const len = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
      return vec.map((v) => v / len);
    }
  }

  async extractText(filePath: string, mimeType: string): Promise<string> {
    if (this.isMockMode()) {
      this.logger.log(`[Mock Mode] Extracting text from file: ${filePath}`);
      return `This is mock extracted text content from the file: ${filePath}. In a real production deployment, this would contain the actual parsed contents of the uploaded document extracted via OpenRouter.`;
    }

    try {
      this.logger.log(`Reading file ${filePath} (${mimeType}) for OpenRouter processing...`);
      const fileBuffer = await fs.readFile(filePath);
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      this.logger.log(`Analyzing file content using model ${this.defaultModel}...`);
      
      const messages = [
        {
          role: 'system',
          content: EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract and format the contents of this document in clean Markdown.',
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages));
      return responseText;
    } catch (error: any) {
      this.logger.error('Error in extractText using OpenRouter API:', error);
      throw new InternalServerErrorException(`OpenRouter API text extraction failed: ${error.message}`);
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
      return responseText;
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

  async generateExplanation(text: string, level: string, language: string): Promise<any> {
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

    try {
      const messages = [
        { role: 'system', content: EXPLANATION_SYSTEM_PROMPT },
        { role: 'user', content: getExplanationUserPrompt(text, level, language) }
      ];

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(this.cleanJson(responseText));
    } catch (error: any) {
      this.logger.error('Error in generateExplanation:', error);
      throw new InternalServerErrorException(`Explanation generation failed: ${error.message}`);
    }
  }

  async generateExam(text: string, difficulty: string, types: string[], count: number): Promise<any> {
    if (this.isMockMode()) {
      return {
        title: 'Mock Learning Assessment',
        questions: [
          {
            type: 'mcq',
            questionText: 'Which platform allows students to study using AI?',
            options: ['StudyAI', 'LegacyBooks', 'ManualQuiz', 'None'],
            correctAnswer: 'StudyAI',
            explanation: 'StudyAI is the AI-powered SaaS described in the document.',
            difficulty: 'easy',
            points: 1,
          },
          {
            type: 'true_false',
            questionText: 'OpenRouter API supports PDF document processing natively.',
            options: null,
            correctAnswer: 'true',
            explanation: 'OpenRouter supports multimodal input files up to limits of the underlying model.',
            difficulty: 'easy',
            points: 1,
          },
        ],
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
}
