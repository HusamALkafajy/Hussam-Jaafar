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

  private async callOpenRouter(messages: Array<{ role: string; content: any }>, jsonMode = false): Promise<string> {
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

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
      return JSON.parse(responseText || '{}');
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
      return JSON.parse(responseText || '{}');
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

      const responseText = await this.runWithRetry(() => this.callOpenRouter(messages, true));
      return JSON.parse(responseText || '{}');
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
      return JSON.parse(responseText || '{}');
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
      return JSON.parse(responseText || '{}');
    } catch (error: any) {
      this.logger.error('Error in chatWithDocument:', error);
      throw new InternalServerErrorException(`Document Q&A failed: ${error.message}`);
    }
  }
}
