import FirecrawlApp from "@mendable/firecrawl-js";
import { generateText } from "@/lib/gemini";
import { ScoutState, ExtractedLead } from "../graph";

const BATCH = 5;

async function extractLeadFromPage(url: string, content: string): Promise<ExtractedLead | null> {
  const prompt = `Extract business contact info from this webpage content. Return JSON only, no explanation.
Schema: { "companyName": string, "email": string | null, "description": string }
URL: ${url}
Content: ${content.slice(0, 2000)}`;

  try {
    const text = await generateText(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.companyName) return null;
    return {
      companyName: parsed.companyName,
      email: parsed.email ?? null,
      website: url,
      description: parsed.description ?? "",
    };
  } catch {
    return null;
  }
}

export async function scrapeNode(state: ScoutState): Promise<Partial<ScoutState>> {
  const firecrawl = new FirecrawlApp({ apiKey: state.firecrawlApiKey });

  const leads: ExtractedLead[] = [];

  for (let i = 0; i < state.rawResults.length; i += BATCH) {
    const batch = state.rawResults.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (r) => {
        try {
          const scraped = await firecrawl.scrape(r.url, { formats: ["markdown"] });
          const content = (scraped as { markdown?: string }).markdown ?? r.snippet;
          return extractLeadFromPage(r.url, content);
        } catch {
          return extractLeadFromPage(r.url, r.snippet);
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        leads.push(result.value);
      }
    }
  }

  return { leads };
}
