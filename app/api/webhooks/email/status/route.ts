import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";
import { logError } from "@/lib/activity";

const EVENT_TO_STATUS: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "sent",
  "email.opened": "opened",
  "email.clicked": "clicked",
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
  clicked: 3,
  bounced: 4,
  complained: 5,
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
      select: { email: true, id: true, companyName: true, state: true, orgId: true },
    });

    if (lead?.email) {
      // Scoped find-or-create instead of upsert-by-email: works before AND after
      // the Suppression unique constraint moves from global email to [orgId, email].
      const email = lead.email.toLowerCase();
      const existing = await db.suppression.findFirst({
        where: { orgId: lead.orgId, email },
      });
      if (existing) {
        await db.suppression.update({ where: { id: existing.id }, data: { reason: newStatus } });
      } else {
        await db.suppression.create({
          data: { orgId: lead.orgId, email, reason: newStatus },
        });
      }

      await db.lead.update({
        where: { id: lead.id },
        data: { state: newStatus === "bounced" ? "bounced" : "unsubscribed" },
      });

      await db.job.updateMany({
        where: { leadId: lead.id, status: "pending" },
        data: { status: "cancelled" },
      });

      if (newStatus === "complained") {
        // A spam complaint is a sender-reputation event, not just a lost lead.
        await logError(
          lead.orgId,
          `${lead.companyName} marked your email as spam — review your opener copy and volume`,
          "/leads",
          `complaint:${lead.id}`,
        );
      }

      // Notify the org that owns the lead — never another tenant's chat.
      const settings = lead.orgId
        ? await db.settings.findUnique({
            where: { orgId: lead.orgId },
            select: { telegramChatId: true },
          })
        : null;

      if (settings?.telegramChatId) {
        const icon = newStatus === "bounced" ? "🔴" : "⚠️";
        const msg = `${icon} <b>Email ${newStatus}</b>\n${escapeHtml(lead.companyName)} (${escapeHtml(lead.email)})\nLead suppressed — no further emails will be sent.`;
        await sendTelegramMessage(settings.telegramChatId, msg).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
