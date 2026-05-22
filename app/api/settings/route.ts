import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.settings.findUnique({ where: { userId } });
  return NextResponse.json(settings ?? {});
}

export async function PUT(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowed = [
    "offerText", "fromEmail", "fromName", "telegramChatId",
    "resendApiKey", "firecrawlApiKey", "anthropicApiKey",
    "calendarId", "dailySendLimit", "autoSendReplies",
    "googleClientId", "googleClientSecret", "googleRefreshToken",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const settings = await db.settings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  return NextResponse.json(settings);
}
