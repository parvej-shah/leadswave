import { GoogleGenerativeAI } from "@google/generative-ai";

function loadKeys(): string[] {
  const multi = process.env.GEMINI_API_KEYS;
  if (multi) {
    const keys = multi.split(",").map((k) => k.trim()).filter(Boolean);
    if (keys.length > 0) return keys;
  }
  const single = process.env.GEMINI_API_KEY;
  return single ? [single] : [];
}

function nextUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|quota|rate.?limit|exceeded/i.test(msg);
}

const keys = loadKeys();
const cooldownUntil = new Map<string, number>(); // key -> epoch ms
let cursor = 0;

function pickKey(): { key: string; index: number } | null {
  if (keys.length === 0) return null;
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const idx = (cursor + i) % keys.length;
    const k = keys[idx];
    const cd = cooldownUntil.get(k) ?? 0;
    if (cd <= now) {
      cursor = (idx + 1) % keys.length;
      return { key: k, index: idx };
    }
  }
  return null;
}

function maskKey(k: string): string {
  if (k.length <= 8) return "***";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export function getGeminiModel(model = "gemini-flash-latest") {
  const picked = pickKey();
  if (!picked) throw new Error("No Gemini API key available (all quotas exhausted or none configured)");
  const genAI = new GoogleGenerativeAI(picked.key);
  return genAI.getGenerativeModel({ model });
}

export async function generateText(prompt: string, model = "gemini-flash-latest"): Promise<string> {
  if (keys.length === 0) throw new Error("GEMINI_API_KEY/GEMINI_API_KEYS not set");

  let lastErr: unknown = null;
  const tried = new Set<number>();

  while (tried.size < keys.length) {
    const picked = pickKey();
    if (!picked) break;
    if (tried.has(picked.index)) break;
    tried.add(picked.index);

    try {
      const genAI = new GoogleGenerativeAI(picked.key);
      const gemini = genAI.getGenerativeModel({ model });
      const result = await gemini.generateContent(prompt);
      return result.response.text().trim();
    } catch (err) {
      lastErr = err;
      if (isQuotaError(err)) {
        cooldownUntil.set(picked.key, nextUtcMidnight());
        console.warn(`[gemini] key ${maskKey(picked.key)} quota hit — cooling down until next UTC day`);
        continue;
      }
      throw err;
    }
  }

  throw lastErr ?? new Error("All Gemini keys exhausted");
}
