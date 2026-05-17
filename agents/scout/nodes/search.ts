import FirecrawlApp from "@mendable/firecrawl-js";
import { ScoutState } from "../graph";

export async function searchNode(state: ScoutState): Promise<Partial<ScoutState>> {
  const app = new FirecrawlApp({ apiKey: state.firecrawlApiKey });

  const query = `${state.query} ${state.location} email contact`;
  const result = await app.search(query, { limit: 10 });

  const items = result.web ?? [];
  const rawResults = items.map((r) => ({
    url: (r as { url?: string }).url ?? "",
    snippet: (r as { markdown?: string; description?: string }).markdown
      ?? (r as { description?: string }).description
      ?? "",
    title: (r as { title?: string }).title ?? "",
  })).slice(0, 10);

  return { rawResults };
}
