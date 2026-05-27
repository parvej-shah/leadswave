import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSystemSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = [
    "offerText", "fromEmail", "fromName", "telegramChatId",
    "resendApiKey", "firecrawlApiKey", "anthropicApiKey",
    "calendarId", "dailySendLimit", "perCampaignDailyLimit", "sendThrottleSeconds",
    "autoSendReplies", "googleClientId", "googleClientSecret", "googleRefreshToken",
    "notifyHotOnly", "notifyEmailDigest",
  ] as const;

  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  // Find the first settings record
  let settings = await db.settings.findFirst();

  if (settings) {
    settings = await db.settings.update({
      where: { id: settings.id },
      data,
    });
  } else {
    settings = await db.settings.create({
      data: {
        userId,
        ...data,
      },
    });
  }

  return NextResponse.json(settings);
}

