import FirecrawlApp from "@mendable/firecrawl-js";
import { ScoutState } from "../graph";

const BLOCKED_HOST_PATTERNS = [
  "clutch.co",
  "designrush.com",
  "quora.com",
  "reddit.com",
  "facebook.com",
  "linkedin.com",
  "yelp.com",
  "yellowpages.com",
  "goodfirms.co",
  "sortlist.com",
  "upwork.com",
  "fiverr.com",
];

function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOST_PATTERNS.some((p) => host === p || host.endsWith(`.${p}`));
  } catch {
    return true;
  }
}

export async function searchNode(state: ScoutState): Promise<Partial<ScoutState>> {
  const app = new FirecrawlApp({ apiKey: state.firecrawlApiKey });

  const query = `${state.query} ${state.location} official website contact email -directory -listing -forum`;
  const result = await app.search(query, { limit: 10 });

  const items = result.web ?? [];
  const rawResults = items.map((r) => ({
    url: (r as { url?: string }).url ?? "",
    snippet: (r as { markdown?: string; description?: string }).markdown
      ?? (r as { description?: string }).description
      ?? "",
    title: (r as { title?: string }).title ?? "",
  }))
    .filter((r) => r.url && !isBlockedHost(r.url))
    .slice(0, 10);

  return { rawResults };
}
