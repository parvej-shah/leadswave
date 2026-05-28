import FirecrawlApp from "@mendable/firecrawl-js";
import { ScoutState, ExtractedLead } from "../graph";
import { extractFromUrl } from "../lib/extract";

const BATCH = 5;

export async function scrapeNode(state: ScoutState): Promise<Partial<ScoutState>> {
  const firecrawl = new FirecrawlApp({ apiKey: state.firecrawlApiKey });

  const leads: ExtractedLead[] = [];

  for (let i = 0; i < state.rawResults.length; i += BATCH) {
    const batch = state.rawResults.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((r) => extractFromUrl(firecrawl, r.url, r.snippet))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        leads.push(result.value);
      }
    }
  }

  return { leads };
}
