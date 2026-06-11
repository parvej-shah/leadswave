import FirecrawlApp from "@mendable/firecrawl-js";
import { generateText } from "@/lib/gemini";
import { ExtractedLead } from "../graph";

const MAX_CONTENT = 7000;
const MAX_PAGES_PER_SITE = 4;

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

// Domains that show up in page source but are never a business contact
// (error trackers, site-builder internals, placeholder text).
const NOISE_EMAIL_DOMAINS = [
  "example.com",
  "sentry.io",
  "rollbar.com",
  "wixpress.com",
  "sentry-next.wixpress.com",
];

export function isBlockedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_HOST_PATTERNS.some((p) => host === p || host.endsWith(`.${p}`));
  } catch {
    return true;
  }
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ASSET_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".css", ".js"];

function isNoiseEmailDomain(domain: string): boolean {
  return [...BLOCKED_HOST_PATTERNS, ...NOISE_EMAIL_DOMAINS].some(
    (p) => domain === p || domain.endsWith(`.${p}`)
  );
}

function filterEmails(candidates: string[]): string[] {
  const valid: string[] = [];
  for (const raw of candidates) {
    const e = raw.trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) continue;
    if (ASSET_EXTENSIONS.some((ext) => e.endsWith(ext))) continue;
    if (e.startsWith("noreply@") || e.startsWith("no-reply@")) continue;
    const domain = e.split("@")[1] ?? "";
    if (isNoiseEmailDomain(domain)) continue;
    valid.push(e);
  }
  return Array.from(new Set(valid));
}

export function extractEmails(content: string): string[] {
  return filterEmails(content.match(EMAIL_RE) ?? []);
}

/** Normalize "info [at] domain [dot] com" style obfuscation so EMAIL_RE can match. */
export function deobfuscateEmails(text: string): string {
  return text
    .replace(/\s*[\[({]\s*(?:at|@)\s*[\])}]\s*/gi, "@")
    .replace(/\s*[\[({]\s*(?:dot|\.)\s*[\])}]\s*/gi, ".")
    .replace(/([a-z0-9._%+-]) AT ([a-z0-9.-])/g, "$1@$2")
    .replace(/([a-z0-9-]) DOT ([a-z0-9-])/g, "$1.$2");
}

/** Decode Cloudflare email-protection hex (first byte is the XOR key). */
function decodeCfEmail(hex: string): string | null {
  if (hex.length < 4 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  }
  return out.includes("@") ? out : null;
}

function emailFromMailto(href: string): string | null {
  const m = href.match(/^mailto:([^?]+)/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Pull emails the markdown view loses: Cloudflare-obfuscated and mailto: hrefs. */
function emailsFromHtml(html: string): string[] {
  if (!html) return [];
  const found: string[] = [];
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) {
    const decoded = decodeCfEmail(m[1]);
    if (decoded) found.push(decoded);
  }
  for (const m of html.matchAll(/email-protection#([0-9a-f]+)/gi)) {
    const decoded = decodeCfEmail(m[1]);
    if (decoded) found.push(decoded);
  }
  for (const m of html.matchAll(/mailto:([^"'?\s>&]+)/gi)) {
    try {
      found.push(decodeURIComponent(m[1]));
    } catch {
      found.push(m[1]);
    }
  }
  return found;
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

type ScrapedPage = { markdown: string; html: string; links: string[] };

async function scrapePage(firecrawl: FirecrawlApp, url: string): Promise<ScrapedPage> {
  try {
    const doc = (await firecrawl.scrape(url, { formats: ["markdown", "html", "links"] })) as {
      markdown?: string;
      html?: string;
      links?: string[];
    };
    return { markdown: doc.markdown ?? "", html: doc.html ?? "", links: doc.links ?? [] };
  } catch {
    return { markdown: "", html: "", links: [] };
  }
}

function harvestEmails(pages: ScrapedPage[], extraText: string): string[] {
  const text = [extraText, ...pages.map((p) => p.markdown)].filter(Boolean).join("\n\n");
  const candidates = [
    ...(text.match(EMAIL_RE) ?? []),
    ...(deobfuscateEmails(text).match(EMAIL_RE) ?? []),
  ];
  for (const page of pages) {
    candidates.push(...emailsFromHtml(page.html));
    for (const link of page.links) {
      const email = emailFromMailto(link);
      if (email) candidates.push(email);
    }
  }
  return filterEmails(candidates);
}

/**
 * Detect a usable contact form: a <form> whose first ~2500 chars contain a
 * message textarea or an email input. Mail-less leads with a form are still
 * reachable (Layer 4 channel).
 */
function detectContactForm(html: string): boolean {
  if (!html) return false;
  return /<form[\s\S]{0,2500}?(<textarea|type=["']email["']|name=["'](?:email|message)["'])/i.test(html);
}

const FB_NOISE_PATHS = /^\/(sharer|share|plugins|tr|login|dialog|hashtag|groups\/?$)/i;

/** First Facebook *page* link on the site (skip share/login widget URLs). */
function findFacebookUrl(pages: ScrapedPage[]): string | null {
  for (const page of pages) {
    for (const link of page.links) {
      try {
        const u = new URL(link);
        if (!/(^|\.)facebook\.com$/i.test(u.hostname)) continue;
        if (FB_NOISE_PATHS.test(u.pathname) || u.pathname === "/") continue;
        return `https://www.facebook.com${u.pathname}`;
      } catch {
        continue;
      }
    }
  }
  return null;
}

const CONTACT_PATH_RE = /contact|about|team|staff|people|enquir|inquiry|impressum|kontakt|get-?in-?touch|reach/i;
const FALLBACK_PATHS = ["/contact", "/contact-us", "/about", "/about-us"];

/**
 * Find the contact/about pages that actually exist on the site via Firecrawl's
 * map endpoint, instead of blindly scraping a list of guessed paths (most of
 * which 404 and waste credits). Falls back to a short guess list if map fails.
 */
async function discoverContactUrls(firecrawl: FirecrawlApp, url: string): Promise<string[]> {
  let root: string;
  try {
    const u = new URL(url);
    root = `${u.protocol}//${u.host}`;
  } catch {
    return [url];
  }
  try {
    const mapped = (await firecrawl.map(root, { search: "contact about team", limit: 30 })) as {
      links?: Array<string | { url?: string }>;
    };
    const contactish = (mapped.links ?? [])
      .map((l) => (typeof l === "string" ? l : l.url ?? ""))
      .filter((candidate) => {
        try {
          return CONTACT_PATH_RE.test(new URL(candidate).pathname);
        } catch {
          return false;
        }
      });
    if (contactish.length > 0) {
      return Array.from(new Set([url, ...contactish])).slice(0, MAX_PAGES_PER_SITE);
    }
  } catch {
    // map unavailable — fall through to guessed paths
  }
  return Array.from(new Set([url, ...FALLBACK_PATHS.map((p) => `${root}${p}`)]));
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
  const candidates = await discoverContactUrls(firecrawl, url);
  const pages = await Promise.all(candidates.map((u) => scrapePage(firecrawl, u)));
  const combined = [fallbackSnippet, ...pages.map((p) => p.markdown)].filter(Boolean).join("\n\n");
  const emails = harvestEmails(pages, fallbackSnippet);
  const hasContactForm = pages.some((p) => detectContactForm(p.html));
  const facebookUrl = findFacebookUrl(pages);
  if (!combined.trim()) {
    if (emails.length === 0) return null;
    return {
      companyName: new URL(url).hostname.replace(/^www\./, ""),
      email: rankEmails(emails)[0],
      website: url,
      description: "",
      hasContactForm,
      facebookUrl,
    };
  }
  const lead = await extractLeadFromPage(url, combined, emails);
  if (!lead) return null;
  return { ...lead, hasContactForm, facebookUrl };
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
  // SMBs with no site often list an email only on their Facebook page; Google
  // indexes the About text, so the email shows up in search snippets.
  queries.push(`"${companyName}" ${locationHint} facebook email`.trim());
  queries.push(`"${companyName}" email`.trim());
  return queries;
}

type SearchItem = { url?: string; title?: string; description?: string; markdown?: string };

export async function findContactByWebSearch(
  firecrawl: FirecrawlApp,
  companyName: string,
  locationHint: string,
  website?: string,
): Promise<{ email: string; description: string } | null> {
  const queries = buildSearchQueries(companyName, locationHint, website);

  for (const query of queries) {
    let items: SearchItem[];
    try {
      const result = (await firecrawl.search(query, { limit: 5 })) as { web?: SearchItem[] };
      items = result.web ?? [];
    } catch {
      continue;
    }

    // Fast path: email already visible in the result title/snippet. Trust it
    // even when the result page is a blocked host (e.g. a Facebook page's
    // About text) — platform-domain addresses are filtered by filterEmails.
    for (const item of items) {
      const snippet = [item.title, item.description, item.markdown].filter(Boolean).join("\n");
      const snippetEmails = rankEmails(extractEmails(deobfuscateEmails(snippet)));
      if (snippetEmails.length > 0) {
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
