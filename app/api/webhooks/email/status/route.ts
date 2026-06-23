import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";

const EVENT_TO_STATUS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "sent",
  "email.opened": "opened",
  "email.clicked": "opened",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "bounced",
  "email.suppressed": "bounced",
};

const TERMINAL_STATUSES = new Set(["bounced", "complained"]);

const STATUS_PRIORITY: Record<string, number> = {
  sent: 0,
  delivered: 1,
  opened: 2,
  bounced: 3,
  complained: 4,
};

export async function POST(req: NextRequest) {
  let payload: { type?: string; data?: { email_id?: string; to?: string[] } };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.type;
  const resendId = payload.data?.email_id;

  if (!eventType || !resendId) {
    return NextResponse.json({ error: "Missing type or email_id" }, { status: 400 });
  }

  const newStatus = EVENT_TO_STATUS[eventType];
  if (!newStatus) {
    return NextResponse.json({ ok: true, skipped: true, reason: "unhandled event type" });
  }

  const message = await db.message.findFirst({ where: { resendId } });
  if (!message) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no matching message" });
  }

  const currentPriority = STATUS_PRIORITY[message.deliveryStatus ?? "sent"] ?? 0;
  const newPriority = STATUS_PRIORITY[newStatus] ?? 0;

  if (newPriority <= currentPriority && !TERMINAL_STATUSES.has(newStatus)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "status not advanced" });
  }

  await db.message.update({
    where: { id: message.id },
    data: { deliveryStatus: newStatus },
  });

  if (TERMINAL_STATUSES.has(newStatus)) {
    const lead = await db.lead.findUnique({
      where: { id: message.leadId },
      select: { email: true, id: true, companyName: true, state: true },
    });

    if (lead?.email) {
      await db.suppression.upsert({
        where: { email: lead.email },
        create: { email: lead.email, reason: newStatus },
        update: { reason: newStatus },
      });

      await db.lead.update({
        where: { id: lead.id },
        data: { state: newStatus === "bounced" ? "bounced" : "unsubscribed" },
      });

      await db.job.updateMany({
        where: { leadId: lead.id, status: "pending" },
        data: { status: "cancelled" },
      });

      const settings = await db.settings.findFirst({
        where: { telegramChatId: { not: null } },
        select: { telegramChatId: true },
      });

      if (settings?.telegramChatId) {
        const icon = newStatus === "bounced" ? "🔴" : "⚠️";
        const msg = `${icon} <b>Email ${newStatus}</b>\n${escapeHtml(lead.companyName)} (${escapeHtml(lead.email)})\nLead suppressed — no further emails will be sent.`;
        await sendTelegramMessage(settings.telegramChatId, msg).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
