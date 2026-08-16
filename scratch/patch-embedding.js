const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'apps/api/src/modules/ai/ai.service.ts');
let code = fs.readFileSync(p, 'utf8');

const oldGetEmbedding = `      const data = await res.json();
      if (!data?.data?.[0]?.embedding) {`;

const newGetEmbedding = `      const data = await res.json();
      
      const store = requestContext.getStore();
      const userId = (store?.user as any)?.id;
      if (userId && data?.usage) {
        saveTokenUsage(userId, 'embedding', data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0, this.embeddingModel).catch(() => {});
      }
      
      if (!data?.data?.[0]?.embedding) {`;
      
code = code.replace(oldGetEmbedding, newGetEmbedding);

// Add checkQuota to getEmbedding
const oldGetEmbeddingStart = "  async getEmbedding(text: string): Promise<number[]> {";
const newGetEmbeddingStart = "  async getEmbedding(text: string): Promise<number[]> {\n    const store = requestContext.getStore();\n    const userId = (store?.user as any)?.id;\n    if (userId) await checkQuota(userId);\n";
code = code.replace(oldGetEmbeddingStart, newGetEmbeddingStart);

fs.writeFileSync(p, code);