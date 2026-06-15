const dotenv = require('dotenv');
const path = require('path');
import { ConfigService } from '@nestjs/config';
import { AiService } from '../modules/ai/ai.service';

// Load env from monorepo root
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function runTest() {
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

  let defaultBaseUrl = 'https://openrouter.ai/api';
  if (!hasOpenRouterKey && hasGeminiKey) {
    defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
  }

  const model = process.env.OPENROUTER_MODEL || process.env.GEMINI_MODEL || (hasOpenRouterKey ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash');

  console.log('API Key Status:', apiKey ? 'CONFIGURED' : 'MISSING (Running in Mock Mode)');
  console.log('Target Model:', model);
  console.log('Base URL:', process.env.OPENROUTER_BASE_URL || defaultBaseUrl);

  const configService = new ConfigService({
    ai: {
      apiKey: apiKey,
      baseUrl: process.env.OPENROUTER_BASE_URL || defaultBaseUrl,
      model: model,
    }
  });


  const aiService = new AiService(configService);

  try {
    console.log('Invoking generateSummary on AiService...');
    const result = await aiService.generateSummary(
      'OpenRouter is an API aggregator that allows developers to access multiple language models through a single, unified interface. It supports models from Google, OpenAI, Anthropic, and many others, offering flexible routing and pricing.',
      'short',
      'en'
    );
    console.log('\n--- Test Result ---');
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('\n--- Test Failed ---');
    console.error(err.message || err);
  }
}

runTest();
