import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await db.settings.findFirst({
    select: { telegramChatId: true, notifyEmailDigest: true },
  });

  if (!settings?.notifyEmailDigest || !settings.telegramChatId) {
    return NextResponse.json({ ok: true, skipped: true, reason: "digest disabled or no chat ID" });
  }

  const now = new Date();
  const yesterdayStart = new Date(now);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  yesterdayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() + 1);

  const [sent, replies, hotLeads, meetings, newLeads] = await Promise.all([
    db.message.count({
      where: { direction: "outbound", sentAt: { gte: yesterdayStart, lt: yesterdayEnd } },
    }),
    db.message.count({
      where: { direction: "inbound", sentAt: { gte: yesterdayStart, lt: yesterdayEnd } },
    }),
    db.lead.count({
      where: { state: "replied", lastTouchedAt: { gte: yesterdayStart, lt: yesterdayEnd } },
    }),
    db.lead.count({
      where: { state: "meeting_booked", lastTouchedAt: { gte: yesterdayStart, lt: yesterdayEnd } },
    }),
    db.lead.count({
      where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd } },
    }),
  ]);

  const dateLabel = yesterdayStart.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });

  const lines = [
    `📊 <b>Daily Digest — ${dateLabel}</b>`,
    "",
    `✉️ Emails sent: <b>${sent}</b>`,
    `📥 Replies received: <b>${replies}</b>`,
    `🔥 HOT leads: <b>${hotLeads}</b>`,
    `📅 Meetings booked: <b>${meetings}</b>`,
    `👥 New leads scouted: <b>${newLeads}</b>`,
  ];

  if (hotLeads > 0 || meetings > 0) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    lines.push("", `→ ${appUrl}/inbox`);
  }

  await sendTelegramMessage(settings.telegramChatId, lines.join("\n"));

  return NextResponse.json({ ok: true, sent, replies, hotLeads, meetings, newLeads });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
