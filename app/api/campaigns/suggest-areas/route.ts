import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEmailAllowed } from "@/lib/allowlist";
import { generateText } from "@/lib/gemini";

async function getUserId() {
  const session = await auth();
  if (!isEmailAllowed(session?.user?.email)) return null;
  return session?.user?.id ?? null;
}

export type SuggestedArea = { area: string; reason: string; score: number };
export type CityAreas = { city: string; areas: SuggestedArea[] };

// Cities are batched smaller now because each city returns many more areas —
// keeps every Gemini response well under the JSON-truncation limit.
const CITIES_PER_BATCH = 3;
// Generous safety cap; the score threshold does the real filtering, not this.
const MAX_AREAS_PER_CITY = 40;
// Areas scoring below this are dropped as too sparse to bother scouting.
const MIN_AREA_SCORE = 20;

function buildPrompt(businessType: string, country: string, cities: string[]): string {
  return `You are a local business intelligence analyst with detailed knowledge of ${country}'s cities.

Task: For EACH city listed below, identify EVERY named area (neighborhood, commercial district, market area, business hub) that has a meaningful concentration of "${businessType}" businesses. Be exhaustive — list ALL such areas, not just the top few. Large cities may have 20-40+ qualifying areas; smaller cities fewer. Include every area worth scouting.

Cities: ${cities.join(", ")}

Hard requirements:
- Only REAL area names that appear on Google Maps as localities/neighborhoods/districts of that exact city.
- Use the locally-used name, transliterated to Latin script.
- Do NOT invent names. Do NOT return street addresses, individual malls/buildings, or the city name itself.
- Order areas best-first by density of "${businessType}" businesses.
- Assign each area a score 1-100 for its relative density. Only include areas that genuinely have these businesses — it is fine to return many areas, but do not pad the list with areas that have almost none.

Return JSON only, no prose, no markdown fences:
{"cities":[{"city":"<exact city name as given above>","areas":[{"area":"string","reason":"one short phrase why this area has many of these businesses","score":0}]}]}

score = relative density rank 1-100 within that city (100 = densest area).`;
}

function parseBatch(text: string, requestedCities: string[]): CityAreas[] {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];
  let parsed: { cities?: Array<{ city?: string; areas?: SuggestedArea[] }> };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
  const byLower = new Map(requestedCities.map((c) => [c.toLowerCase(), c]));
  const out: CityAreas[] = [];
  for (const entry of parsed.cities ?? []) {
    if (!entry || typeof entry.city !== "string") continue;
    // Map Gemini's spelling back to the exact requested city string
    const city = byLower.get(entry.city.trim().toLowerCase());
    if (!city) continue;
    const seen = new Set<string>();
    const areas = (entry.areas ?? [])
      .filter((a) => a && typeof a.area === "string" && a.area.trim())
      .map((a) => ({
        area: a.area.trim(),
        reason: typeof a.reason === "string" ? a.reason : "",
        score: typeof a.score === "number" ? a.score : 0,
      }))
      .filter((a) => {
        const key = a.area.toLowerCase();
        if (key === city.toLowerCase() || seen.has(key)) return false;
        if (a.score < MIN_AREA_SCORE) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_AREAS_PER_CITY);
    if (areas.length > 0) out.push({ city, areas });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { businessType = "", country = "", cities = [] } = (body ?? {}) as {
    businessType?: string;
    country?: string;
    cities?: string[];
  };

  const cleanCities = (Array.isArray(cities) ? cities : [])
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim())
    .filter(Boolean);

  if (!businessType.trim() || !country.trim() || cleanCities.length === 0) {
    return NextResponse.json({ error: "businessType, country and cities are required" }, { status: 400 });
  }

  // Batch cities to keep each Gemini response small enough to avoid JSON truncation;
  // a failed batch yields partial results instead of failing the whole request.
  const batches: string[][] = [];
  for (let i = 0; i < cleanCities.length; i += CITIES_PER_BATCH) {
    batches.push(cleanCities.slice(i, i + CITIES_PER_BATCH));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      try {
        const text = await generateText(buildPrompt(businessType, country, batch));
        return parseBatch(text, batch);
      } catch (err) {
        console.warn("[suggest-areas] batch failed:", err instanceof Error ? err.message : err);
        return [] as CityAreas[];
      }
    })
  );

  const areas = results.flat();
  if (areas.length === 0) {
    return NextResponse.json({ error: "AI did not return valid area suggestions" }, { status: 502 });
  }

  return NextResponse.json({ areas });
}
