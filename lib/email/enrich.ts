import { EmailVerdict } from "./verify";
import { rankEmails } from "@/agents/scout/lib/extract";

export type EnrichmentProvider = "hunter" | "anymailfinder";

export type EnrichedEmail = {
  email: string;
  status: EmailVerdict;
};

/**
 * Hunter.io domain search: returns emails Hunter has seen on the web for this
 * domain, with per-address verification status and confidence.
 */
async function enrichViaHunter(apiKey: string, domain: string): Promise<EnrichedEmail | null> {
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(apiKey)}&limit=10`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
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

/**
 * Layer 3: last-paid-resort email lookup via a third-party enrichment API.
 * Returns null on any provider failure — enrichment must never break the
 * enrichment pipeline it backs up.
 */
export async function enrichEmail(opts: {
  provider: EnrichmentProvider;
  apiKey: string;
  companyName: string;
  domain?: string | null;
}): Promise<EnrichedEmail | null> {
  try {
    if (opts.provider === "hunter") {
      if (!opts.domain) return null; // Hunter searches by domain only
      return await enrichViaHunter(opts.apiKey, opts.domain);
    }
    return await enrichViaAnymailfinder(opts.apiKey, opts.companyName, opts.domain);
  } catch {
    return null;
  }
}
