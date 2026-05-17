import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiModel(model = "gemini-flash-latest") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}

export async function generateText(prompt: string, model = "gemini-flash-latest"): Promise<string> {
  const gemini = getGeminiModel(model);
  const result = await gemini.generateContent(prompt);
  return result.response.text().trim();
}
