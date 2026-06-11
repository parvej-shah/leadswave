import { resolveMx } from "node:dns/promises";

export type EmailVerdict = "verified" | "catch_all" | "invalid" | "unknown";

export type VerifiedEmail = {
  email: string;
  status: EmailVerdict;
};

/** Free-mail providers where pattern guessing makes no sense. */
const FREEMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "yandex.com",
];

export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.includes(domain.toLowerCase());
}

export function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Does the domain accept mail at all? One free DNS lookup — if no MX, no email exists there. */
export async function domainHasMx(domain: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("MX timeout")), timeoutMs)),
    ]);
    return records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Verify a single address via MillionVerifier (SMTP handshake done on their
 * side — never verify from our own IP, it tanks sender reputation).
 * Returns "unknown" on any API failure so callers can decide how to degrade.
 */
export async function verifyEmailAddress(email: string, apiKey: string): Promise<EmailVerdict> {
  try {
    const url = `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}&timeout=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return "unknown";
    const data = (await res.json()) as { result?: string };
    switch (data.result) {
      case "ok":
        return "verified";
      case "catch_all":
        return "catch_all";
      case "invalid":
      case "disposable":
        return "invalid";
      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
}

const GUESS_PREFIXES = ["info", "contact", "hello", "office", "admin"];

/**
 * Layer 2 core: for a business domain with no published email, guess common
 * mailbox names and verify them without sending. Returns the first address
 * that verifies, or the best catch-all candidate (medium confidence — the
 * domain accepts everything, so the guess can't be confirmed).
 */
export async function guessAndVerifyEmail(domain: string, apiKey: string): Promise<VerifiedEmail | null> {
  if (isFreemailDomain(domain)) return null;
  if (!(await domainHasMx(domain))) return null;

  for (const prefix of GUESS_PREFIXES) {
    const candidate = `${prefix}@${domain}`;
    const verdict = await verifyEmailAddress(candidate, apiKey);
    if (verdict === "verified") return { email: candidate, status: "verified" };
    // Catch-all domains return the same answer for every mailbox — no point
    // burning credits on more guesses; report info@ as the medium-confidence pick.
    if (verdict === "catch_all") return { email: candidate, status: "catch_all" };
    // "unknown" (API down/timeout) — stop guessing rather than storing blind guesses
    if (verdict === "unknown") return null;
  }
  return null;
}

/**
 * Verify an email we found by scraping/search. Without an API key we can at
 * least check MX. Returns the status to store on the lead.
 */
export async function verifyFoundEmail(email: string, apiKey?: string): Promise<EmailVerdict> {
  const domain = email.split("@")[1] ?? "";
  if (!domain) return "invalid";
  if (apiKey) return verifyEmailAddress(email, apiKey);
  return (await domainHasMx(domain)) ? "unknown" : "invalid";
}
