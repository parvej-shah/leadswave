import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    from?: { id: number };
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
  const cronSecret = process.env.CRON_SECRET ?? "";

  const headers: Record<string, string> = {};
  if (cronSecret) headers["Authorization"] = `Bearer ${cronSecret}`;

  const res = await fetch(`${appUrl}/api/cron/process-jobs`, { headers });
  if (!res.ok) throw new Error(`Job processor returned ${res.status}`);
  return res.json() as Promise<{ processed: number; failed: number; total: number }>;
}

async function getStatus(): Promise<string> {
  const [totalLeads, emailsSent, hotLeads, meetings, pendingJobs] = await Promise.all([
    db.lead.count({ where: { deletedAt: null } }),
    db.message.count({ where: { direction: "outbound" } }),
    db.lead.count({ where: { state: "replied" } }),
    db.lead.count({ where: { state: "meeting_booked" } }),
    db.job.count({ where: { status: "pending", scheduledAt: { lte: new Date() } } }),
  ]);

  return [
    "📊 <b>LeadsWave Status</b>",
    "",
    `👥 Total leads: <b>${totalLeads}</b>`,
    `✉️ Emails sent: <b>${emailsSent}</b>`,
    `🔥 Hot leads: <b>${hotLeads}</b>`,
    `📅 Meetings booked: <b>${meetings}</b>`,
    `⏳ Follow-ups due now: <b>${pendingJobs}</b>`,
    "",
    pendingJobs > 0
      ? `Send /followups to process them now.`
      : `No follow-ups due — all caught up!`,
  ].join("\n");
}

// Verify the request is from Telegram using the bot token hash
// For simplicity in MVP we check a shared secret set as the webhook secret token
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true; // dev: no secret, allow all
  return req.headers.get("x-telegram-bot-api-secret-token") === secret;
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

  // Auto-save chat ID to settings if not already stored
  if (command === "/start") {
    await db.settings.updateMany({
      where: { telegramChatId: null },
      data: { telegramChatId: String(chatId) },
    });
    await replyToChat(
      chatId,
      "👋 <b>LeadsWave bot connected!</b>\n\nCommands:\n/followups — process due follow-up emails\n/status — show pipeline stats",
    );
    return NextResponse.json({ ok: true });
  }

  if (command === "/followups") {
    await replyToChat(chatId, "⏳ Processing follow-up jobs…");
    try {
      const result = await processFollowupJobs();
      const msg =
        result.total === 0
          ? "✅ No follow-up jobs due right now — all caught up!"
          : [
              `✅ <b>Follow-ups processed</b>`,
              `Sent: ${result.processed}`,
              result.failed > 0 ? `Failed: ${result.failed}` : "",
              `Total jobs: ${result.total}`,
            ]
              .filter(Boolean)
              .join("\n");
      await replyToChat(chatId, msg);
    } catch (err) {
      await replyToChat(chatId, `❌ Error: ${String(err)}`);
    }
    return NextResponse.json({ ok: true });
  }

  if (command === "/status") {
    try {
      const status = await getStatus();
      await replyToChat(chatId, status);
    } catch (err) {
      await replyToChat(chatId, `❌ Error fetching status: ${String(err)}`);
    }
    return NextResponse.json({ ok: true });
  }

  // Unknown command
  await replyToChat(
    chatId,
    "Unknown command.\n\n/followups — process due follow-up emails\n/status — show pipeline stats",
  );
  return NextResponse.json({ ok: true });
}

// Telegram requires a 200 OK for all updates — never return an error status to Telegram
export async function GET() {
  return NextResponse.json({ ok: true, info: "Telegram webhook endpoint" });
}
