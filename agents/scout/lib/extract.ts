import FirecrawlApp from "@mendable/firecrawl-js";
import { generateText } from "@/lib/gemini";
import { ExtractedLead } from "../graph";

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

export function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOST_PATTERNS.some((p) => host === p || host.endsWith(`.${p}`));
  } catch {
    return true;
  }
}

export function extractEmails(content: string): string[] {
  const matches = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const filtered = matches
    .map((m) => m.trim().toLowerCase())
    .filter((e) => !e.includes("example.com"))
    .filter((e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".jpeg") && !e.endsWith(".webp"))
    .filter((e) => !e.startsWith("noreply@") && !e.startsWith("no-reply@"))
    .filter((e) => !e.startsWith("support@") || !e.includes("sentry") ) // filter sentry/monitoring noise
    .filter((e) => !e.includes("@sentry.io") && !e.includes("@rollbar.com"));
  return Array.from(new Set(filtered));
}

const PREFERRED_PREFIXES = ["contact", "info", "hello", "hi", "enquir", "inquiry", "enquiry", "admin", "office", "mail", "team"];
const DEPRIORITIZED_PREFIXES = ["sales", "marketing", "pr", "press", "media", "privacy", "legal", "billing", "invoice", "careers", "jobs", "hr", "recruit"];

export function rankEmails(emails: string[]): string[] {
  return [...emails].sort((a, b) => {
    const aLocal = a.split("@")[0] ?? "";
    const bLocal = b.split("@")[0] ?? "";
    const aScore = PREFERRED_PREFIXES.some((p) => aLocal.startsWith(p)) ? 2
      : DEPRIORITIZED_PREFIXES.some((p) => aLocal.startsWith(p)) ? 0 : 1;
    const bScore = PREFERRED_PREFIXES.some((p) => bLocal.startsWith(p)) ? 2
      : DEPRIORITIZED_PREFIXES.some((p) => bLocal.startsWith(p)) ? 0 : 1;
    return bScore - aScore;
  });
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
    const candidates = [
      url,
      `${root}/contact`,
      `${root}/contact-us`,
      `${root}/get-in-touch`,
      `${root}/reach-us`,
      `${root}/about`,
      `${root}/about-us`,
      `${root}/team`,
      `${root}/our-team`,
      `${root}/meet-the-team`,
      `${root}/staff`,
      `${root}/people`,
      `${root}/partners`,
      `${root}/associates`,
      `${root}/lawyers`,
      `${root}/attorneys`,
      `${root}/enquiry`,
      `${root}/reach`,
    ];
    return Array.from(new Set(candidates));
  } catch {
    return [url];
  }
}

async function extractLeadFromPage(url: string, content: string, fallbackEmails: string[]): Promise<ExtractedLead | null> {
  const ranked = rankEmails(fallbackEmails);
  const prompt = `Extract business contact info from this webpage content. Return JSON only, no explanation.
Schema: { "companyName": string, "email": string | null, "description": string }
URL: ${url}
Emails found on page (ranked best-first): ${ranked.join(", ") || "none"}
Prefer contact@/info@/hello@ over sales@/marketing@ emails. Pick the most likely primary contact email.
Content: ${content.slice(0, MAX_CONTENT)}`;

  try {
    const text = await generateText(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.companyName) return null;
    const pickedEmail = parsed.email ?? ranked[0] ?? null;
    return {
      companyName: parsed.companyName,
      email: pickedEmail,
      website: url,
      description: parsed.description ?? "",
    };
  } catch {
    if (ranked.length === 0) return null;
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "");
      const name = host.split(".")[0]?.replace(/[-_]/g, " ") ?? host;
      return {
        companyName: name.replace(/\b\w/g, (m) => m.toUpperCase()),
        email: ranked[0],
        website: `${u.protocol}//${u.host}`,
        description: "",
      };
    } catch {
      return null;
    }
  }
}

export async function extractFromUrl(firecrawl: FirecrawlApp, url: string, fallbackSnippet: string): Promise<ExtractedLead | null> {
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

/**
 * Last-resort contact discovery for businesses with no website of their own:
 * web-search the business name + location and try to pull an email off whatever
 * pages turn up (social profiles, directories, news). Returns the first email found.
 */
function buildSearchQueries(companyName: string, locationHint: string, website?: string): string[] {
  const queries: string[] = [];
  // Domain-scoped search is most precise when we have a website
  if (website) {
    try {
      const host = new URL(website).hostname;
      queries.push(`site:${host} email contact`);
    } catch { /* ignore invalid URL */ }
  }
  queries.push(`"${companyName}" ${locationHint} contact email`.trim());
  queries.push(`"${companyName}" email`.trim());
  return queries;
}

export async function findContactByWebSearch(
  firecrawl: FirecrawlApp,
  companyName: string,
  locationHint: string,
  website?: string,
): Promise<{ email: string; description: string } | null> {
  const queries = buildSearchQueries(companyName, locationHint, website);

  for (const query of queries) {
    let result: { data?: Array<{ url?: string; markdown?: string }> };
    try {
      result = (await firecrawl.search(query, { limit: 5 })) as typeof result;
    } catch {
      continue;
    }

    const items = result.data ?? [];

    // Fast path: email already in search snippet
    for (const item of items) {
      const snippetEmails = rankEmails(extractEmails(item.markdown ?? ""));
      if (snippetEmails.length > 0 && item.url && !isBlockedHost(item.url)) {
        return { email: snippetEmails[0], description: "" };
      }
    }

    // Slow path: scrape top non-blocked pages
    const urls = items
      .map((r) => r.url ?? "")
      .filter((u) => u && !isBlockedHost(u))
      .slice(0, 3);

    for (const url of urls) {
      const lead = await extractFromUrl(firecrawl, url, "");
      if (lead?.email) {
        return { email: lead.email, description: lead.description ?? "" };
      }
    }
  }

  return null;
}
