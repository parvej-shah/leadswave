import { NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram/client";

export async function GET() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }
  if (!process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ error: "TELEGRAM_CHAT_ID not set" }, { status: 500 });
  }

  await sendTelegram("System online 🟢");
  return NextResponse.json({ ok: true });
}
