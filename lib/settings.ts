import { db } from "./db";

export type SystemSettings = {
  id?: string;
  userId?: string | null;
  offerText: string;
  fromEmail: string;
  fromName: string;
  resendApiKey: string;
  firecrawlApiKey: string;
  anthropicApiKey: string;
  telegramChatId: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string | null;
  calendarId: string;
  dailySendLimit: number;
  autoSendReplies: boolean;
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const dbSettings = await db.settings.findFirst();

  return {
    id: dbSettings?.id,
    userId: dbSettings?.userId ?? null,
    offerText: dbSettings?.offerText || process.env.OFFER_TEXT || "",
    fromEmail: dbSettings?.fromEmail || process.env.FROM_EMAIL || "",
    fromName: dbSettings?.fromName || process.env.FROM_NAME || "",
    resendApiKey: dbSettings?.resendApiKey || process.env.RESEND_API_KEY || "",
    firecrawlApiKey: dbSettings?.firecrawlApiKey || process.env.FIRECRAWL_API_KEY || "",
    anthropicApiKey: dbSettings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || "",
    telegramChatId: dbSettings?.telegramChatId || process.env.TELEGRAM_CHAT_ID || "",
    googleClientId: dbSettings?.googleClientId || process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: dbSettings?.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || "",
    googleRefreshToken: dbSettings?.googleRefreshToken || process.env.GOOGLE_REFRESH_TOKEN || null,
    calendarId: dbSettings?.calendarId || process.env.CALENDAR_ID || "primary",
    dailySendLimit: dbSettings?.dailySendLimit ?? Number(process.env.DAILY_SEND_LIMIT ?? 100),
    autoSendReplies: dbSettings?.autoSendReplies ?? (process.env.AUTO_SEND_REPLIES === "true"),
  };
}
