import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateText } from "@/lib/gemini";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export type SuggestedCity = { city: string; reason: string; score: number };

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { businessType = "", country = "" } = (body ?? {}) as {
    businessType?: string;
    country?: string;
  };

  if (!businessType.trim() || !country.trim()) {
    return NextResponse.json({ error: "businessType and country are required" }, { status: 400 });
  }

  const prompt = `You are a market analyst. For the business type "${businessType}" in ${country}, rank the top 8 cities by market opportunity (business density and local spending power).
Return JSON only, no prose, no markdown:
{ "cities": [ { "city": "string", "reason": "short phrase", "score": 0 } ] }
score is an integer 1-100 (higher = better opportunity), cities ordered best first.`;

  try {
    const text = await generateText(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI did not return valid city suggestions" }, { status: 502 });
    }
    const parsed = JSON.parse(jsonMatch[0]) as { cities?: SuggestedCity[] };
    const cities = (parsed.cities ?? [])
      .filter((c) => c && typeof c.city === "string" && c.city.trim())
      .map((c) => ({
        city: c.city.trim(),
        reason: typeof c.reason === "string" ? c.reason : "",
        score: typeof c.score === "number" ? c.score : 0,
      }));

    if (cities.length === 0) {
      return NextResponse.json({ error: "No cities returned" }, { status: 502 });
    }

    return NextResponse.json({ cities });
  } catch {
    return NextResponse.json({ error: "Failed to suggest cities" }, { status: 502 });
  }
}
