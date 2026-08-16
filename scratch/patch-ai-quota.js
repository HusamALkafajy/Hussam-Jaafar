const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'apps/api/src/modules/ai/ai.service.ts');
let code = fs.readFileSync(p, 'utf8');

code = code.replace(/import \{ saveTokenUsage \} from '\.\/token-tracking';/, "import { saveTokenUsage } from './token-tracking';\nimport { checkQuota } from './quota-guard';");

code = code.replace(/  private async callOpenRouter\(\n/, "  private async callOpenRouter(\n");
// Find callOpenRouter body start
const oldCallOpenRouterStart = "  ): Promise<string> {\n    // this.baseUrl already contains /v1 (set by ai.config.ts), so append only the path.\n    const url = `${this.baseUrl}/chat/completions`;";
const newCallOpenRouterStart = "  ): Promise<string> {\n    const store = requestContext.getStore();\n    const userId = (store?.user as any)?.id;\n    if (userId) await checkQuota(userId);\n\n    // this.baseUrl already contains /v1 (set by ai.config.ts), so append only the path.\n    const url = `${this.baseUrl}/chat/completions`;";
code = code.replace(oldCallOpenRouterStart, newCallOpenRouterStart);

// Now patch stream
const oldStreamDef = "    const store = requestContext.getStore();\n    const userId = (store?.user as any)?.id;\n    return new Observable((subscriber) => {";
const newStreamDef = "    const store = requestContext.getStore();\n    const userId = (store?.user as any)?.id;\n    return new Observable((subscriber) => {\n      if (userId) {\n        checkQuota(userId).catch(err => subscriber.error(err));\n      }";
code = code.replace(oldStreamDef, newStreamDef);

fs.writeFileSync(p, code);