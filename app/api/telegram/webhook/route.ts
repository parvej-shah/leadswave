import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createEvent } from "@/lib/calendar/client";
import { getSystemSettings } from "@/lib/settings";
import { getOrgOwnerGoogleToken } from "@/lib/tenant";
import { sendsDisabled, dryRunSend } from "@/lib/email/guard";
import { logActivity } from "@/lib/activity";

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
  };
};

/**
 * Telegram calls this endpoint; authenticate it with the secret_token set via
 * setWebhook (arrives as X-Telegram-Bot-Api-Secret-Token). Without the env the
 * gate is open — same dev convention as CRON_SECRET.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers.get("x-telegram-bot-api-secret-token") === secret;
}

async function replyToChat(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

/** The org this chat is bound to (via /start <connect-code>), or null. */
async function orgForChat(chatId: number): Promise<string | null> {
  const settings = await db.settings.findFirst({
    where: { telegramChatId: String(chatId) },
    select: { orgId: true },
  });
  return settings?.orgId ?? null;
}

async function processFollowupJobs(): Promise<{ processed: number; failed: number; total: number }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const headers: Record<string, string> = {};
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) headers["Authorization"] = `Bearer ${cronSecret}`;
  const res = await fetch(`${appUrl}/api/cron/process-jobs`, { headers });
  if (!res.ok) throw new Error(`Job processor returned ${res.status}`);
  return res.json() as Promise<{ processed: number; failed: number; total: number }>;
}

async function getStatus(orgId: string): Promise<string> {
  const [totalLeads, emailsSent, hotLeads, meetings, pendingJobs, pendingConfirms] = await Promise.all([
    db.lead.count({ where: { orgId, deletedAt: null } }),
    db.message.count({ where: { direction: "outbound", lead: { orgId } } }),
    db.lead.count({ where: { orgId, state: "replied" } }),
    db.lead.count({ where: { orgId, state: "meeting_booked" } }),
    db.job.count({ where: { status: "pending", scheduledAt: { lte: new Date() }, lead: { orgId } } }),
    db.pendingConfirmation.count({ where: { status: "pending" } }),
  ]);

  return [
    "📊 <b>LeadsWave Status</b>",
    "",
    `👥 Total leads: <b>${totalLeads}</b>`,
    `✉️ Emails sent: <b>${emailsSent}</b>`,
    `🔥 Hot leads: <b>${hotLeads}</b>`,
    `📅 Meetings booked: <b>${meetings}</b>`,
    `⏳ Follow-ups due now: <b>${pendingJobs}</b>`,
    pendingConfirms > 0 ? `🤔 Awaiting your confirmation: <b>${pendingConfirms}</b>` : "",
    "",
    pendingJobs > 0 ? "Send /followups to process them." : "No follow-ups due — all caught up!",
  ].filter(Boolean).join("\n");
}

async function handleConfirm(pendingId: string, slotIndex: number, chatId: number) {
  const chatOrgId = await orgForChat(chatId);
  const pending = await db.pendingConfirmation.findUnique({ where: { id: pendingId } });
  if (!pending || pending.status !== "pending") {
    await replyToChat(chatId, "⚠️ This confirmation is no longer valid.");
    return;
  }

  // The confirmation must belong to the chat's own org.
  const lead = await db.lead.findUnique({
    where: { id: pending.leadId },
    select: { orgId: true },
  });
  if (!lead?.orgId || lead.orgId !== chatOrgId) {
    await replyToChat(chatId, "⚠️ This confirmation is no longer valid.");
    return;
  }
  const orgId = lead.orgId;

  const ctx = JSON.parse(pending.context) as {
    companyName: string; email: string;
    slots: { start: string; end: string }[];
    inboundBody: string;
  };

  const rawSlot = ctx.slots[slotIndex] ?? ctx.slots[0];
  const slot = { start: new Date(rawSlot.start), end: new Date(rawSlot.end) };

  const settings = await getSystemSettings(orgId);
  const ownerToken = await getOrgOwnerGoogleToken(orgId);
  const refreshToken = ownerToken?.refreshToken ?? settings.googleRefreshToken;

  if (!settings.googleClientId || !settings.googleClientSecret || !refreshToken) {
    await replyToChat(chatId, "❌ Google Calendar not connected. Go to Settings to connect.");
    return;
  }

  await replyToChat(chatId, `⏳ Booking meeting with ${ctx.companyName}…`);

  const slotLabel = slot.start.toLocaleString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  });

  const event = await createEvent(
    settings.googleClientId, settings.googleClientSecret, refreshToken,
    settings.calendarId ?? "primary",
    slot,
    `Meeting with ${ctx.companyName}`,
    ctx.email,
  ).catch((err) => { console.error("[confirm] calendar error:", err); return null; });

  if (!event) {
    await replyToChat(chatId, `❌ Failed to create calendar event. Try again or book manually.`);
    return;
  }

  await Promise.all([
    db.calendarEvent.create({
      data: {
        leadId: pending.leadId,
        googleEventId: event.eventId,
        meetLink: event.meetLink,
        startTime: event.start,
        endTime: event.end,
        title: `Meeting with ${ctx.companyName}`,
      },
    }),
    db.lead.update({ where: { id: pending.leadId }, data: { state: "meeting_booked", lastTouchedAt: new Date() } }),
    db.pendingConfirmation.update({ where: { id: pendingId }, data: { status: "confirmed" } }),
  ]);

  await logActivity({
    orgId,
    type: "meeting_booked",
    leadId: pending.leadId,
    summary: `Meeting booked with ${ctx.companyName} (${slotLabel})`,
  });

  // Send confirmation email to lead
  if (settings.resendApiKey && settings.fromEmail && ctx.email) {
    const { Resend } = await import("resend");
    const resend = new Resend(settings.resendApiKey);
    const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
    const body = `Great — I've booked our meeting for ${slotLabel}.${event.meetLink ? `\n\nGoogle Meet: ${event.meetLink}` : ""}\n\nLooking forward to it!`;
    if (sendsDisabled()) dryRunSend(ctx.email, `Meeting confirmed – ${ctx.companyName}`);
    else await resend.emails.send({ from, to: ctx.email, subject: `Meeting confirmed – ${ctx.companyName}`, text: body }).catch(() => null);
    await db.message.create({ data: { leadId: pending.leadId, direction: "outbound", subject: `Meeting confirmed – ${ctx.companyName}`, body } });
  }

  await replyToChat(
    chatId,
    [
      `📅 <b>Meeting booked with ${ctx.companyName}</b>`,
      slotLabel,
      event.meetLink ? `Google Meet: ${event.meetLink}` : "",
    ].filter(Boolean).join("\n"),
  );
}

async function handleSkip(pendingId: string, chatId: number) {
  const chatOrgId = await orgForChat(chatId);
  const pending = await db.pendingConfirmation.findUnique({ where: { id: pendingId } });
  if (!pending) { await replyToChat(chatId, "⚠️ Not found."); return; }

  const lead = await db.lead.findUnique({ where: { id: pending.leadId }, select: { orgId: true } });
  if (!lead?.orgId || lead.orgId !== chatOrgId) {
    await replyToChat(chatId, "⚠️ Not found.");
    return;
  }

  const ctx = JSON.parse(pending.context) as { companyName: string };
  await db.pendingConfirmation.update({ where: { id: pendingId }, data: { status: "skipped" } });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  await replyToChat(chatId, `✅ Skipped. Handle ${ctx.companyName} manually → ${appUrl}/inbox`);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const text = message.text.trim();
  const command = text.split(" ")[0].toLowerCase().replace(/@\S+$/, "");

  // /confirm_<pendingId>_<slotIndex>
  const confirmMatch = command.match(/^\/confirm_([a-z0-9]+)_([012])$/);
  if (confirmMatch) {
    await handleConfirm(confirmMatch[1], parseInt(confirmMatch[2]), chatId);
    return NextResponse.json({ ok: true });
  }

  // /skip_<pendingId>
  const skipMatch = command.match(/^\/skip_([a-z0-9]+)$/);
  if (skipMatch) {
    await handleSkip(skipMatch[1], chatId);
    return NextResponse.json({ ok: true });
  }

  if (command === "/start") {
    // /start <connect-code> binds this chat to the org that generated the code
    // (Settings → Notifications → "Connect Telegram"). A bare /start no longer
    // blindly claims every settings row.
    const code = text.split(/\s+/)[1]?.trim();
    if (!code) {
      await replyToChat(
        chatId,
        "👋 To connect this chat, generate a connect code in LeadsWave Settings and send:\n/start <code>",
      );
      return NextResponse.json({ ok: true });
    }

    const settings = await db.settings.findFirst({
      where: { telegramConnectCode: code },
      select: { id: true },
    });
    if (!settings) {
      await replyToChat(chatId, "❌ Invalid or expired connect code. Generate a new one in Settings.");
      return NextResponse.json({ ok: true });
    }

    await db.settings.update({
      where: { id: settings.id },
      data: { telegramChatId: String(chatId), telegramConnectCode: null },
    });
    await replyToChat(
      chatId,
      [
        "👋 <b>LeadsWave bot connected!</b>",
        "",
        "Commands:",
        "/followups — process due follow-up emails",
        "/status — show pipeline stats",
        "",
        "When AI is uncertain about booking, it will ask you here with /confirm and /skip options.",
      ].join("\n"),
    );
    return NextResponse.json({ ok: true });
  }

  // Everything below requires a connected chat.
  const orgId = await orgForChat(chatId);
  if (!orgId) {
    await replyToChat(chatId, "This chat isn't connected. Generate a connect code in LeadsWave Settings, then send /start <code>.");
    return NextResponse.json({ ok: true });
  }

  if (command === "/followups") {
    await replyToChat(chatId, "⏳ Processing follow-up jobs…");
    try {
      const result = await processFollowupJobs();
      const msg = result.total === 0
        ? "✅ No follow-up jobs due right now — all caught up!"
        : [`✅ <b>Follow-ups processed</b>`, `Sent: ${result.processed}`, result.failed > 0 ? `Failed: ${result.failed}` : "", `Total: ${result.total}`].filter(Boolean).join("\n");
      await replyToChat(chatId, msg);
    } catch (err) {
      await replyToChat(chatId, `❌ Error: ${String(err)}`);
    }
    return NextResponse.json({ ok: true });
  }

  if (command === "/status") {
    try {
      await replyToChat(chatId, await getStatus(orgId));
    } catch (err) {
      await replyToChat(chatId, `❌ Error: ${String(err)}`);
    }
    return NextResponse.json({ ok: true });
  }

  await replyToChat(chatId, "Commands:\n/followups\n/status");
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "Telegram webhook endpoint" });
}
