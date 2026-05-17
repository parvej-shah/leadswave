import { GoogleGenerativeAI } from "@google/generative-ai";

async function main() {
  const key = process.env.GEMINI_API_KEY;
  console.log("key present:", !!key, "prefix:", key?.slice(0, 8));
  const genAI = new GoogleGenerativeAI(key!);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  const result = await model.generateContent('Classify this email reply as hot/warm/cold/ooo/bounce. Reply: "Yes interested, lets hop on a call". Return JSON {"classification": "hot"}');
  console.log("response:", result.response.text());
}
main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
