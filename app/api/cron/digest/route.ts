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

  // One digest per org that opted in
  const orgSettings = await db.settings.findMany({
    where: { notifyEmailDigest: true, telegramChatId: { not: null } },
    select: { orgId: true, telegramChatId: true },
  });

  if (orgSettings.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no org has digest enabled" });
  }

  const now = new Date();
  const yesterdayStart = new Date(now);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  yesterdayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() + 1);

  const results: Record<string, unknown>[] = [];

  for (const { orgId, telegramChatId } of orgSettings) {
    if (!orgId || !telegramChatId) continue;

    const [sent, replies, hotLeads, meetings, newLeads] = await Promise.all([
      db.message.count({
        where: { direction: "outbound", sentAt: { gte: yesterdayStart, lt: yesterdayEnd }, lead: { orgId } },
      }),
      db.message.count({
        where: { direction: "inbound", sentAt: { gte: yesterdayStart, lt: yesterdayEnd }, lead: { orgId } },
      }),
      db.lead.count({
        where: { orgId, state: "replied", lastTouchedAt: { gte: yesterdayStart, lt: yesterdayEnd } },
      }),
      db.lead.count({
        where: { orgId, state: "meeting_booked", lastTouchedAt: { gte: yesterdayStart, lt: yesterdayEnd } },
      }),
      db.lead.count({
        where: { orgId, createdAt: { gte: yesterdayStart, lt: yesterdayEnd } },
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

    await sendTelegramMessage(telegramChatId, lines.join("\n")).catch(() => {});
    results.push({ orgId, sent, replies, hotLeads, meetings, newLeads });
  }

  return NextResponse.json({ ok: true, orgs: results });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
