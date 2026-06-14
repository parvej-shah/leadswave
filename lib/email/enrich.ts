import { EmailVerdict } from "./verify";
import { rankEmails } from "@/agents/scout/lib/extract";

export type EnrichmentProvider = "hunter" | "anymailfinder" | "apify";

export type EnrichedEmail = {
  email: string;
  status: EmailVerdict;
};

/**
 * Thrown when a provider rejects a call because the account is out of credits
 * for the month. The caller uses this to switch to a fallback provider for the
 * rest of the run instead of retrying a provider that will keep refusing.
 */
export class QuotaExceededError extends Error {
  constructor(public provider: string) {
    super(`${provider} quota exceeded`);
    this.name = "QuotaExceededError";
  }
}

/**
 * Hunter.io domain search: returns emails Hunter has seen on the web for this
 * domain, with per-address verification status and confidence.
 * Throws QuotaExceededError when Hunter reports the monthly credit limit is hit.
 */
async function enrichViaHunter(apiKey: string, domain: string): Promise<EnrichedEmail | null> {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(apiKey)}&limit=10`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  // 429 = rate/usage limit. Hunter also returns 401/403 with a "usage" error
  // body when the plan's monthly searches are exhausted; treat those as quota.
  if (res.status === 429) throw new QuotaExceededError("hunter");
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    if (/quota|usage|limit|credit/i.test(body)) throw new QuotaExceededError("hunter");
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json()) as {
    data?: {
      emails?: Array<{
        value?: string;
        type?: string;
        confidence?: number;
        verification?: { status?: string };
      }>;
    };
  };
  const emails = data.data?.emails ?? [];
  if (emails.length === 0) return null;

  // Prefer generic mailboxes (info@/contact@) over personal ones for a first
  // touch, then let rankEmails order by prefix quality.
  const byAddress = new Map(emails.filter((e) => e.value).map((e) => [e.value!.toLowerCase(), e]));
  const generic = emails.filter((e) => e.type === "generic" && e.value).map((e) => e.value!.toLowerCase());
  const ranked = rankEmails(generic.length > 0 ? generic : Array.from(byAddress.keys()));
  const picked = ranked[0];
  if (!picked) return null;

  const meta = byAddress.get(picked);
  const status: EmailVerdict =
    meta?.verification?.status === "valid" ? "verified"
    : meta?.verification?.status === "accept_all" ? "catch_all"
    : (meta?.confidence ?? 0) >= 90 ? "verified"
    : "unknown";
  return { email: picked, status };
}

/**
 * Anymailfinder company search: charges only for verified results, which fits
 * pay-per-hit enrichment of SMB leads.
 */
async function enrichViaAnymailfinder(
  apiKey: string,
  companyName: string,
  domain?: string | null,
): Promise<EnrichedEmail | null> {
  const res = await fetch("https://api.anymailfinder.com/v5.0/search/company.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(domain ? { domain } : { company_name: companyName }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    email?: string | null;
    validation?: string;
    results?: { email?: string | null; validation?: string };
  };
  const email = (data.email ?? data.results?.email ?? "").toLowerCase();
  if (!email || !email.includes("@")) return null;
  const validation = data.validation ?? data.results?.validation ?? "";
  const status: EmailVerdict =
    validation === "valid" ? "verified"
    : validation === "risky" ? "catch_all"
    : "unknown";
  return { email, status };
}

// Apify actor used to scrape contact info (emails/phones/socials) from a URL.
// Override with APIFY_CONTACT_ACTOR if you prefer a different actor.
const APIFY_CONTACT_ACTOR = process.env.APIFY_CONTACT_ACTOR || "vdrmota~contact-info-scraper";

/**
 * Apify contact-info scraper: runs an actor against the lead's website and
 * pulls any emails it finds. Used as the fallback once Hunter's monthly quota
 * is exhausted. Runs synchronously (run-sync) and reads the dataset in one call.
 * Throws QuotaExceededError if the Apify account is out of usage credits.
 */
async function enrichViaApify(apiKey: string, websiteUrl: string): Promise<EnrichedEmail | null> {
  const endpoint = `https://api.apify.com/v2/acts/${APIFY_CONTACT_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: [{ url: websiteUrl }],
      maxRequestsPerStartUrl: 5,
      maxDepth: 1,
    }),
    // Actor runs can take a while; give it room but not forever.
    signal: AbortSignal.timeout(120000),
  });
  if (res.status === 402 || res.status === 429) throw new QuotaExceededError("apify");
  if (!res.ok) return null;

  const items = (await res.json().catch(() => null)) as
    | Array<{ emails?: string[]; email?: string | string[] }>
    | null;
  if (!Array.isArray(items)) return null;

  // Flatten every email the actor reported across crawled pages.
  const found = new Set<string>();
  for (const item of items) {
    const list = [
      ...(Array.isArray(item.emails) ? item.emails : []),
      ...(Array.isArray(item.email) ? item.email : item.email ? [item.email] : []),
    ];
    for (const e of list) {
      const addr = String(e).toLowerCase().trim();
      if (addr.includes("@")) found.add(addr);
    }
  }
  if (found.size === 0) return null;

  const picked = rankEmails(Array.from(found))[0];
  if (!picked) return null;
  // Apify only scrapes the address off the page — it doesn't verify deliverability.
  return { email: picked, status: "unknown" };
}

/**
 * Layer 3: last-paid-resort email lookup via a third-party enrichment API.
 * Returns null on a provider miss/failure, but RE-THROWS QuotaExceededError so
 * the caller can switch to a fallback provider for the rest of the run.
 */
export async function enrichEmail(opts: {
  provider: EnrichmentProvider;
  apiKey: string;
  companyName: string;
  domain?: string | null;
  websiteUrl?: string | null;
}): Promise<EnrichedEmail | null> {
  try {
    if (opts.provider === "hunter") {
      if (!opts.domain) return null; // Hunter searches by domain only
      return await enrichViaHunter(opts.apiKey, opts.domain);
    }
    if (opts.provider === "apify") {
      const url = opts.websiteUrl || (opts.domain ? `https://${opts.domain}` : null);
      if (!url) return null; // Apify scrapes a URL
      return await enrichViaApify(opts.apiKey, url);
    }
    return await enrichViaAnymailfinder(opts.apiKey, opts.companyName, opts.domain);
  } catch (err) {
    if (err instanceof QuotaExceededError) throw err; // let the caller fall back
    return null;
  }
}
