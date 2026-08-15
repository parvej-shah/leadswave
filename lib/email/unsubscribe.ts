import { createHmac, timingSafeEqual } from "crypto";

function getUnsubscribeSecret(): string {
  return (
    process.env.SETTINGS_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET ||
    "leadswave-unsub-secret-key-fallback-32b"
  );
}

export type UnsubscribePayload = {
  orgId: string;
  leadId?: string;
  email: string;
  expiresAt: number; // unix timestamp in ms
};

/**
 * Generate a secure URL-safe HMAC token for a lead/email.
 * Token valid for 90 days.
 */
export function generateUnsubscribeToken(params: {
  orgId: string;
  leadId?: string;
  email: string;
}): string {
  const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
  const payloadData = `${params.orgId}:${params.leadId || ""}:${params.email.toLowerCase().trim()}:${expiresAt}`;
  const payloadB64 = Buffer.from(payloadData, "utf8").toString("base64url");
  const secret = getUnsubscribeSecret();
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

/**
 * Verify and decode an unsubscribe token.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, sig] = parts;
    const secret = getUnsubscribeSecret();
    const expectedSig = createHmac("sha256", secret).update(payloadB64).digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const [orgId, leadId, email, expiresAtStr] = payloadStr.split(":");
    const expiresAt = Number(expiresAtStr);

    if (!orgId || !email || !expiresAt || Date.now() > expiresAt) {
      return null;
    }

    return {
      orgId,
      leadId: leadId || undefined,
      email,
      expiresAt,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Build the full public unsubscribe URL.
 */
export function buildUnsubscribeUrl(params: {
  orgId: string;
  leadId?: string;
  email: string;
  baseUrl?: string;
}): string {
  const token = generateUnsubscribeToken(params);
  const base =
    params.baseUrl ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://getminions.ai");

  const origin = base.startsWith("http") ? base : `https://${base}`;
  return `${origin}/unsubscribe?token=${encodeURIComponent(token)}`;
}
