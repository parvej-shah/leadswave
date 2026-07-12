import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateText } from "@/lib/gemini";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export type SuggestedCity = { city: string; reason: string; score: number };

// Cities scoring below this are dropped as too sparse to bother with.
const MIN_CITY_SCORE = 10;
// Generous safety cap; the score threshold does the real filtering.
const MAX_CITIES = 60;

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

  const prompt = `You are a business intelligence analyst specializing in geographic market data.

Task: For the business type "${businessType}" in ${country}, identify EVERY city that has a meaningful number of "${businessType}" businesses physically present and operating. Be exhaustive — include large metros, secondary cities, and smaller regional towns that still have a real cluster of these businesses. A country may have anywhere from a handful to 40+ qualifying cities; list them all.

Ranking criteria (in order of priority):
1. Raw count of "${businessType}" businesses registered/operating in the city
2. Commercial district density — cities with concentrated business hubs rank higher
3. Population size as a secondary proxy only when business count data is uncertain

Do NOT rank by economic opportunity, GDP, spending power, or growth potential. Rank strictly by where the most "${businessType}" businesses exist today.

Use your knowledge of ${country}'s geography, major commercial centers, and where this specific business type clusters. For example:
- Pharmacies cluster near hospitals and densely populated residential areas
- Marketing agencies cluster in tech/media/startup hubs
- Law firms cluster in capital cities and financial/commercial districts
- Restaurants cluster in tourism and high foot-traffic areas

Only include cities that genuinely have these businesses — it is fine to return many cities, but do not pad the list with cities that have almost none.

Return JSON only, no prose, no markdown fences:
{"cities":[{"city":"string","reason":"one short phrase explaining why this city has many of these businesses","score":0}]}

score = estimated density rank normalized to 1–100 (100 = city with the most businesses of this type, others relative to it). Order cities best-first.`;


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
      }))
      .filter((c) => c.score >= MIN_CITY_SCORE)
      .slice(0, MAX_CITIES);

    if (cities.length === 0) {
      return NextResponse.json({ error: "No cities returned" }, { status: 502 });
    }

    return NextResponse.json({ cities });
  } catch {
    return NextResponse.json({ error: "Failed to suggest cities" }, { status: 502 });
  }
}
