import { db } from "./db";

export type SystemSettings = {
  id?: string;
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

export async function getSystemSettings(): Promise<SystemSettings> {
  const dbSettings = await db.settings.findFirst();

  return {
    id: dbSettings?.id,
    userId: dbSettings?.userId ?? null,
    offerText: dbSettings?.offerText || process.env.OFFER_TEXT || "",
    fromEmail: dbSettings?.fromEmail || process.env.FROM_EMAIL || "",
    fromName: dbSettings?.fromName || process.env.FROM_NAME || "",
    signatureHtml: dbSettings?.signatureHtml || "",
    signatureText: dbSettings?.signatureText || "",
    resendApiKey: dbSettings?.resendApiKey || process.env.RESEND_API_KEY || "",
    firecrawlApiKey: dbSettings?.firecrawlApiKey || process.env.FIRECRAWL_API_KEY || "",
    anthropicApiKey: dbSettings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || "",
    emailVerifierApiKey: dbSettings?.emailVerifierApiKey || process.env.EMAIL_VERIFIER_API_KEY || "",
    enrichmentProvider: dbSettings?.enrichmentProvider || process.env.ENRICHMENT_PROVIDER || "hunter",
    enrichmentApiKey: dbSettings?.enrichmentApiKey || process.env.ENRICHMENT_API_KEY || "",
    apifyApiKey: dbSettings?.apifyApiKey || process.env.APIFY_API_KEY || "",
    googleMapsApiKey: dbSettings?.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY || "",
    telegramChatId: dbSettings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || "",
    googleClientId: dbSettings?.googleClientId || process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: dbSettings?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || "",
    googleRefreshToken: dbSettings?.googleRefreshToken || process.env.GOOGLE_REFRESH_TOKEN || null,
    calendarId: dbSettings?.calendarId || process.env.CALENDAR_ID || "primary",
    dailySendLimit: dbSettings?.dailySendLimit ?? Number(process.env.DAILY_SEND_LIMIT ?? 100),
    perCampaignDailyLimit: dbSettings?.perCampaignDailyLimit ?? 50,
    sendThrottleSeconds: dbSettings?.sendThrottleSeconds ?? 30,
    autoSendReplies: dbSettings?.autoSendReplies ?? (process.env.AUTO_SEND_REPLIES === "true"),
    notifyHotOnly: dbSettings?.notifyHotOnly ?? false,
    notifyEmailDigest: dbSettings?.notifyEmailDigest ?? false,
  };
}
