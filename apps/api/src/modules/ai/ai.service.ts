import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { EXTRACTION_SYSTEM_PROMPT } from './prompts/extraction.prompts';
import { SUMMARY_SYSTEM_PROMPT, getSummaryUserPrompt } from './prompts/summary.prompts';
import { EXPLANATION_SYSTEM_PROMPT, getExplanationUserPrompt } from './prompts/explanation.prompts';
import { EXAM_SYSTEM_PROMPT, getExamUserPrompt } from './prompts/exam.prompts';
import { FLASHCARD_SYSTEM_PROMPT, getFlashcardUserPrompt } from './prompts/flashcard.prompts';
import { CHAT_SYSTEM_PROMPT, getChatUserPrompt } from './prompts/chat.prompts';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private ai: GoogleGenAI | null = null;
  private defaultModel = 'gemini-2.5-flash';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ai.apiKey');
    this.defaultModel = this.configService.get<string>('ai.model') || 'gemini-2.5-flash';

    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      this.logger.warn('GEMINI_API_KEY is not set. AI features will run in Mock Mode.');
    }
  }

  private isMockMode(): boolean {
    return !this.ai;
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
            `Gemini API returned retryable error (attempt ${attempt}/${maxRetries}): ${error.message || error}. Retrying in ${delay}ms...`
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

  async extractText(filePath: string, mimeType: string): Promise<string> {
    if (this.isMockMode()) {
      this.logger.log(`[Mock Mode] Extracting text from file: ${filePath}`);
      return `This is mock extracted text content from the file: ${filePath}. In a real production deployment, this would contain the actual parsed contents of the uploaded document extracted via Google Gemini API.`;
    }

    try {
      this.logger.log(`Uploading file ${filePath} (${mimeType}) to Gemini Files API...`);
      const uploadResult = await this.runWithRetry(() =>
        this.ai!.files.upload({
          file: filePath,
          config: {
            mimeType: mimeType,
            displayName: 'Uploaded Document',
          },
        })
      );

      this.logger.log(`Analyzing file content using model ${this.defaultModel}...`);
      const response = await this.runWithRetry(() =>
        this.ai!.models.generateContent({
          model: this.defaultModel,
          config: {
            systemInstruction: EXTRACTION_SYSTEM_PROMPT,
          },
          contents: [
            { text: 'Extract and format the contents of this document in clean Markdown.' },
            { fileData: { fileUri: uploadResult.uri, mimeType: uploadResult.mimeType } },
          ],
        })
      );

      // Attempt to delete file after processing
      try {
        if (uploadResult.name) {
          await this.ai!.files.delete({ name: uploadResult.name });
        }
      } catch (delError) {
        this.logger.warn(`Failed to delete file ${uploadResult.name} from Gemini API`, delError);
      }


      if (!response.text) {
        throw new InternalServerErrorException('No text returned from Gemini API');
      }

      return response.text;
    } catch (error: any) {
      this.logger.error('Error in extractText using Gemini API:', error);
      throw new InternalServerErrorException(`Gemini API text extraction failed: ${error.message}`);
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
      const response = await this.runWithRetry(() =>
        this.ai!.models.generateContent({
          model: this.defaultModel,
          config: {
            systemInstruction: SUMMARY_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
          },
          contents: [getSummaryUserPrompt(text, level, language)],
        })
      );

      return JSON.parse(response.text || '{}');
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
      const response = await this.runWithRetry(() =>
        this.ai!.models.generateContent({
          model: this.defaultModel,
          config: {
            systemInstruction: EXPLANATION_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
          },
          contents: [getExplanationUserPrompt(text, level, language)],
        })
      );

      return JSON.parse(response.text || '{}');
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
            questionText: 'Gemini API supports PDF document processing natively.',
            options: null,
            correctAnswer: 'true',
            explanation: 'Gemini API has native support for application/pdf files up to 2GB.',
            difficulty: 'easy',
            points: 1,
          },
        ],
      };
    }

    try {
      const response = await this.runWithRetry(() =>
        this.ai!.models.generateContent({
          model: this.defaultModel,
          config: {
            systemInstruction: EXAM_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
          },
          contents: [getExamUserPrompt(text, difficulty, types, count)],
        })
      );

      return JSON.parse(response.text || '{}');
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
      const response = await this.runWithRetry(() =>
        this.ai!.models.generateContent({
          model: this.defaultModel,
          config: {
            systemInstruction: FLASHCARD_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
          },
          contents: [getFlashcardUserPrompt(text, count)],
        })
      );

      return JSON.parse(response.text || '{}');
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
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      const response = await this.runWithRetry(() =>
        this.ai!.models.generateContent({
          model: this.defaultModel,
          config: {
            systemInstruction: `${CHAT_SYSTEM_PROMPT}\n\nDocument Content:\n${text}`,
            responseMimeType: 'application/json',
          },
          contents: [
            ...formattedHistory,
            { role: 'user', parts: [{ text: getChatUserPrompt(question) }] },
          ],
        })
      );

      return JSON.parse(response.text || '{}');
    } catch (error: any) {
      this.logger.error('Error in chatWithDocument:', error);
      throw new InternalServerErrorException(`Document Q&A failed: ${error.message}`);
    }
  }
}
