import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createEvent } from "@/lib/calendar/client";
import { sendTelegramMessage } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
  };
};

async function replyToChat(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
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

async function getStatus(): Promise<string> {
  const [totalLeads, emailsSent, hotLeads, meetings, pendingJobs, pendingConfirms] = await Promise.all([
    db.lead.count({ where: { deletedAt: null } }),
    db.message.count({ where: { direction: "outbound" } }),
    db.lead.count({ where: { state: "replied" } }),
    db.lead.count({ where: { state: "meeting_booked" } }),
    db.job.count({ where: { status: "pending", scheduledAt: { lte: new Date() } } }),
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
  const pending = await db.pendingConfirmation.findUnique({ where: { id: pendingId } });
  if (!pending || pending.status !== "pending") {
    await replyToChat(chatId, "⚠️ This confirmation is no longer valid.");
    return;
  }

  const ctx = JSON.parse(pending.context) as {
    companyName: string; email: string;
    slots: { start: string; end: string }[];
    inboundBody: string;
  };

  const rawSlot = ctx.slots[slotIndex] ?? ctx.slots[0];
  const slot = { start: new Date(rawSlot.start), end: new Date(rawSlot.end) };

  const settings = await db.settings.findFirst({
    where: { googleClientId: { not: null }, googleClientSecret: { not: null }, googleRefreshToken: { not: null } },
    select: { googleClientId: true, googleClientSecret: true, googleRefreshToken: true, calendarId: true, fromEmail: true, fromName: true, resendApiKey: true },
  });

  if (!settings?.googleClientId || !settings.googleClientSecret || !settings.googleRefreshToken) {
    await replyToChat(chatId, "❌ Google Calendar not connected. Go to Settings to connect.");
    return;
  }

  await replyToChat(chatId, `⏳ Booking meeting with ${ctx.companyName}…`);

  const slotLabel = slot.start.toLocaleString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  });

  const event = await createEvent(
    settings.googleClientId, settings.googleClientSecret, settings.googleRefreshToken,
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

  // Send confirmation email to lead
  if (settings.resendApiKey && settings.fromEmail && ctx.email) {
    const { Resend } = await import("resend");
    const resend = new Resend(settings.resendApiKey);
    const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
    const body = `Great — I've booked our meeting for ${slotLabel}.${event.meetLink ? `\n\nGoogle Meet: ${event.meetLink}` : ""}\n\nLooking forward to it!`;
    await resend.emails.send({ from, to: ctx.email, subject: `Meeting confirmed – ${ctx.companyName}`, text: body }).catch(() => null);
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
  const pending = await db.pendingConfirmation.findUnique({ where: { id: pendingId } });
  if (!pending) { await replyToChat(chatId, "⚠️ Not found."); return; }

  const ctx = JSON.parse(pending.context) as { companyName: string };
  await db.pendingConfirmation.update({ where: { id: pendingId }, data: { status: "skipped" } });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  await replyToChat(chatId, `✅ Skipped. Handle ${ctx.companyName} manually → ${appUrl}/inbox`);
}

export async function POST(req: NextRequest) {
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
    await db.settings.updateMany({
      where: { telegramChatId: null },
      data: { telegramChatId: String(chatId) },
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
      await replyToChat(chatId, await getStatus());
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
