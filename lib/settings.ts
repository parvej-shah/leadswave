import { db } from "./db";
import { decryptSecret } from "./crypto";

export type SystemSettings = {
  id?: string;
  orgId?: string | null;
  userId?: string | null;
  offerText: string;
  fromEmail: string;
  fromName: string;
  signatureHtml: string;
  signatureText: string;
  resendApiKey: string;
  firecrawlApiKey: string;
  anthropicApiKey: string;
  emailVerifierApiKey: string;
  enrichmentProvider: string;
  enrichmentApiKey: string;
  apifyApiKey: string;
  googleMapsApiKey: string;
  telegramChatId: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string | null;
  calendarId: string;
  dailySendLimit: number;
  perCampaignDailyLimit: number;
  sendThrottleSeconds: number;
  autoSendReplies: boolean;
  notifyHotOnly: boolean;
  notifyEmailDigest: boolean;
};

/**
 * Env fallbacks for SECRETS are gated to the default (owner's) org — without
 * this, every tenant would silently inherit the owner's API keys. Identify the
 * default org via DEFAULT_ORG_ID env. Non-secret defaults apply to all orgs.
 */
function envSecretsAllowed(orgId: string): boolean {
  return !!process.env.DEFAULT_ORG_ID && orgId === process.env.DEFAULT_ORG_ID;
}

export async function getSystemSettings(orgId: string): Promise<SystemSettings> {
  const dbSettings = await db.settings.findUnique({ where: { orgId } });
  const env = envSecretsAllowed(orgId)
    ? process.env
    : ({} as Record<string, string | undefined>);

  return {
    id: dbSettings?.id,
    orgId: dbSettings?.orgId ?? orgId,
    userId: dbSettings?.userId ?? null,
    offerText: dbSettings?.offerText || process.env.OFFER_TEXT || "",
    fromEmail: dbSettings?.fromEmail || env.FROM_EMAIL || "",
    fromName: dbSettings?.fromName || env.FROM_NAME || "",
    signatureHtml: dbSettings?.signatureHtml || "",
    signatureText: dbSettings?.signatureText || "",
    resendApiKey: decryptSecret(dbSettings?.resendApiKey) || env.RESEND_API_KEY || "",
    firecrawlApiKey: decryptSecret(dbSettings?.firecrawlApiKey) || env.FIRECRAWL_API_KEY || "",
    anthropicApiKey: decryptSecret(dbSettings?.anthropicApiKey) || env.ANTHROPIC_API_KEY || "",
    emailVerifierApiKey: decryptSecret(dbSettings?.emailVerifierApiKey) || env.EMAIL_VERIFIER_API_KEY || "",
    enrichmentProvider: dbSettings?.enrichmentProvider || process.env.ENRICHMENT_PROVIDER || "hunter",
    enrichmentApiKey: decryptSecret(dbSettings?.enrichmentApiKey) || env.ENRICHMENT_API_KEY || "",
    apifyApiKey: decryptSecret(dbSettings?.apifyApiKey) || env.APIFY_API_KEY || "",
    googleMapsApiKey: decryptSecret(dbSettings?.googleMapsApiKey) || env.GOOGLE_MAPS_API_KEY || "",
    telegramChatId: dbSettings?.telegramChatId || env.TELEGRAM_CHAT_ID || "",
    googleClientId: dbSettings?.googleClientId || env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: decryptSecret(dbSettings?.googleClientSecret) || env.GOOGLE_CLIENT_SECRET || "",
    googleRefreshToken: decryptSecret(dbSettings?.googleRefreshToken) || env.GOOGLE_REFRESH_TOKEN || null,
    calendarId: dbSettings?.calendarId || process.env.CALENDAR_ID || "primary",
    dailySendLimit: dbSettings?.dailySendLimit ?? Number(process.env.DAILY_SEND_LIMIT ?? 100),
    perCampaignDailyLimit: dbSettings?.perCampaignDailyLimit ?? 50,
    sendThrottleSeconds: dbSettings?.sendThrottleSeconds ?? 30,
    autoSendReplies: dbSettings?.autoSendReplies ?? (process.env.AUTO_SEND_REPLIES === "true"),
    notifyHotOnly: dbSettings?.notifyHotOnly ?? false,
    notifyEmailDigest: dbSettings?.notifyEmailDigest ?? false,
  };
}
