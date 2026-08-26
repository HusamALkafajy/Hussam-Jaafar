const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'apps/api/src/modules/ai/ai.service.ts');
let code = fs.readFileSync(p, 'utf8');

// Also add checkQuota here
const oldGeminiSdkStart = "  private async extractTextWithGeminiSdk(filePath: string, mimeType: string): Promise<string> {\n    this.logger.log(";
const newGeminiSdkStart = "  private async extractTextWithGeminiSdk(filePath: string, mimeType: string): Promise<string> {\n    const store = requestContext.getStore();\n    const userId = (store?.user as any)?.id;\n    if (userId) await checkQuota(userId);\n\n    this.logger.log(";
code = code.replace(oldGeminiSdkStart, newGeminiSdkStart);

const trackGemini = `
      const usage = result.response.usageMetadata;
      if (usage && userId) {
        saveTokenUsage(userId, 'extraction', usage.promptTokenCount || 0, usage.candidatesTokenCount || 0, this.geminiModel).catch(() => {});
      }
`;

code = code.replace(/      const candidate = result\.response\.candidates\?\.\[0\];/, trackGemini + "\n      const candidate = result.response.candidates?.[0];");

const trackGeminiFallback = `
      const usage2 = fallbackResult.response.usageMetadata;
      if (usage2 && userId) {
        saveTokenUsage(userId, 'extraction_fallback', usage2.promptTokenCount || 0, usage2.candidatesTokenCount || 0, this.recitationFallbackModel).catch(() => {});
      }
`;
code = code.replace(/      const fallbackCandidate = fallbackResult\.response\.candidates\?\.\[0\];/, trackGeminiFallback + "\n      const fallbackCandidate = fallbackResult.response.candidates?.[0];");

// extractTextWithOpenRouter
const oldOpenRouterExtract = "  private async extractTextWithOpenRouter(filePath: string, mimeType: string): Promise<string> {\n    this.logger.log(";
const newOpenRouterExtract = "  private async extractTextWithOpenRouter(filePath: string, mimeType: string): Promise<string> {\n    const store = requestContext.getStore();\n    const userId = (store?.user as any)?.id;\n    if (userId) await checkQuota(userId);\n\n    this.logger.log(";
code = code.replace(oldOpenRouterExtract, newOpenRouterExtract);

fs.writeFileSync(p, code);