import FirecrawlApp from "@mendable/firecrawl-js";
import { generateText } from "@/lib/gemini";
import { ScoutState, ExtractedLead } from "../graph";

const BATCH = 5;
const MAX_CONTENT = 7000;

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

function extractEmails(content: string): string[] {
  const matches = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const filtered = matches
    .map((m) => m.trim().toLowerCase())
    .filter((e) => !e.includes("example.com"))
    .filter((e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".jpeg") && !e.endsWith(".webp"))
    .filter((e) => !e.startsWith("noreply@") && !e.startsWith("no-reply@"));
  return Array.from(new Set(filtered));
}

async function scrapeMarkdown(firecrawl: FirecrawlApp, url: string): Promise<string> {
  try {
    const scraped = await firecrawl.scrape(url, { formats: ["markdown"] });
    return (scraped as { markdown?: string }).markdown ?? "";
  } catch {
    return "";
  }
}

function getCandidateUrls(url: string): string[] {
  try {
    const u = new URL(url);
    const root = `${u.protocol}//${u.host}`;
    const candidates = [url, `${root}/contact`, `${root}/contact-us`, `${root}/about`, `${root}/about-us`];
    return Array.from(new Set(candidates));
  } catch {
    return [url];
  }
}

async function extractLeadFromPage(url: string, content: string, fallbackEmails: string[]): Promise<ExtractedLead | null> {
  const prompt = `Extract business contact info from this webpage content. Return JSON only, no explanation.
Schema: { "companyName": string, "email": string | null, "description": string }
URL: ${url}
Known emails found on page: ${fallbackEmails.join(", ") || "none"}
Content: ${content.slice(0, MAX_CONTENT)}`;

  try {
    const text = await generateText(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.companyName) return null;
    const pickedEmail = parsed.email ?? fallbackEmails[0] ?? null;
    return {
      companyName: parsed.companyName,
      email: pickedEmail,
      website: url,
      description: parsed.description ?? "",
    };
  } catch {
    if (fallbackEmails.length === 0) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      const name = host.split(".")[0]?.replace(/[-_]/g, " ") ?? host;
      return {
        companyName: name.replace(/\b\w/g, (m) => m.toUpperCase()),
        email: fallbackEmails[0],
        website: `${u.protocol}//${u.host}`,
        description: "",
      };
    } catch {
      return null;
    }
  }
}

async function extractFromUrl(firecrawl: FirecrawlApp, url: string, fallbackSnippet: string): Promise<ExtractedLead | null> {
  if (!url || isBlockedHost(url)) return null;
  const candidates = getCandidateUrls(url);
  const scraped = await Promise.all(candidates.map((u) => scrapeMarkdown(firecrawl, u)));
  const combined = [fallbackSnippet, ...scraped].filter(Boolean).join("\n\n");
  const emails = extractEmails(combined);
  if (!combined.trim()) {
    if (emails.length === 0) return null;
    return {
      companyName: new URL(url).hostname.replace(/^www\./, ""),
      email: emails[0],
      website: url,
      description: "",
    };
  }
  return extractLeadFromPage(url, combined, emails);
}

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
