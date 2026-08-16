const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'apps/api/src/modules/ai/ai.service.ts');
let code = fs.readFileSync(p, 'utf8');

code = code.replace(/import \{ requestContext \} from '\.\.\/\.\.\/common\/request-context';/, "import { requestContext } from '../../common/request-context';\nimport { saveTokenUsage } from './token-tracking';");

const newCallOpenRouter = `
      const data = await res.json();
      if (data?.usage) {
        const store = requestContext.getStore();
        const userId = store?.user?.id;
        if (userId) saveTokenUsage(userId, 'blocking_call', data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0, this.defaultModel).catch(() => {});
      }
      const content = data?.choices?.[0]?.message?.content;
`;
code = code.replace(/      const data = await res\.json\(\);\n      const content = data\?\.choices\?\.\[0\]\?\.message\?\.content;/, newCallOpenRouter);

const oldStreamDef = "    return new Observable((subscriber) => {\n      const url = `/chat/completions`;\n      const headers = {\n        'Authorization': `Bearer `,\n        'Content-Type': 'application/json',\n        'HTTP-Referer': 'https://studyai.com',\n        'X-Title': 'StudyAI',\n      };";
const newStreamDef = "    const store = requestContext.getStore();\n    const userId = store?.user?.id;\n    return new Observable((subscriber) => {\n      const url = `${this.baseUrl}/chat/completions`;\n      const headers = {\n        'Authorization': `Bearer ${this.apiKey}`,\n        'Content-Type': 'application/json',\n        'HTTP-Referer': 'https://studyai.com',\n        'X-Title': 'StudyAI',\n      };";
code = code.replace(oldStreamDef, newStreamDef);

code = code.replace(/stream: true,/, "stream: true,\n        stream_options: { include_usage: true },");
code = code.replace(/subscriber\.error\(new Error\(\`OpenRouter API call failed \\\(HTTP \\\): \`\)\);/, "subscriber.error(new Error(`OpenRouter API call failed (HTTP ${res.status}): ${errorMsg}`));");

const oldUsageChunk = "                    try {\n                      const parsed = JSON.parse(data);\n                      const content = parsed.choices?.[0]?.delta?.content;";
const newUsageChunk = "                    try {\n                      const parsed = JSON.parse(data);\n                      if (parsed.usage && userId) saveTokenUsage(userId, 'stream_call', parsed.usage.prompt_tokens || 0, parsed.usage.completion_tokens || 0, this.defaultModel).catch(() => {});\n                      const content = parsed.choices?.[0]?.delta?.content;";
code = code.replace(oldUsageChunk, newUsageChunk);

fs.writeFileSync(p, code);