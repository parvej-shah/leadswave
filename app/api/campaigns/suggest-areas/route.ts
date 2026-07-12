import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateText } from "@/lib/gemini";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export type SuggestedArea = { area: string; reason: string; score: number };
export type CityAreas = { city: string; areas: SuggestedArea[] };

const CITIES_PER_BATCH = 5;
const MAX_AREAS_PER_CITY = 8;

function buildPrompt(businessType: string, country: string, cities: string[]): string {
  return `You are a local business intelligence analyst with detailed knowledge of ${country}'s cities.

Task: For EACH city listed below, identify the 5-8 named areas (neighborhoods, commercial districts, market areas, business hubs) with the HIGHEST concentration of "${businessType}" businesses.

Cities: ${cities.join(", ")}

Hard requirements:
- Only REAL area names that appear on Google Maps as localities/neighborhoods/districts of that exact city.
- Use the locally-used name, transliterated to Latin script.
- Do NOT invent names. Do NOT return street addresses, individual malls/buildings, or the city name itself.
- Order areas best-first by density of "${businessType}" businesses.

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
