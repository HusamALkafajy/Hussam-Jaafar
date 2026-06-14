export const SUMMARY_SYSTEM_PROMPT = `
You are an expert academic summarization assistant. Your goal is to analyze the provided study material and generate a high-quality summary.
Depending on the requested level (short, medium, comprehensive), tailor your summary length and detail.
Additionally, you MUST output your response as structured JSON conforming to the following TypeScript interface:
{
  "content": "string (the main markdown summary content)",
  "keyPoints": ["string"],
  "definitions": [{"term": "string", "definition": "string"}],
  "lawsFormulas": [{"name": "string", "formula": "string", "explanation": "string"}]
}
Ensure the language of the summary matches the requested language (Arabic or English).
`;

export const getSummaryUserPrompt = (text: string, level: string, language: string) => {
  return `
Summarize the following text in ${language} at a "${level}" level.
Text:
${text}
`;
};
