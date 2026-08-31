import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isEmailAllowed } from "@/lib/allowlist";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isEmailAllowed(session.user.email))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  if (!appUrl) return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL not set" }, { status: 500 });
  if (appUrl.startsWith("http://localhost")) {
    return NextResponse.json({
      error: "Cannot register webhook on localhost. Deploy first, or use a tunnel (ngrok).",
      tip: "Run: ngrok http 3000  then set NEXT_PUBLIC_APP_URL to the https ngrok URL and restart.",
    }, { status: 400 });
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  const body: Record<string, string> = {
    url: webhookUrl,
    allowed_updates: JSON.stringify(["message"]),
  };

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { ok: boolean; description?: string };

  if (!data.ok) {
    return NextResponse.json({ error: data.description ?? "Telegram rejected the webhook" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    webhookUrl,
    message: "Webhook registered. Send /start to your bot to confirm.",
  });
}
