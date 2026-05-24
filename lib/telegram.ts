export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — skipping notification");
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const send = async (payload: Record<string, unknown>) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  let res = await send({ chat_id: chatId, text, parse_mode: "HTML" });
  if (!res.ok) {
    const err = await res.text();
    console.error("[telegram] send failed:", err);
    // Retry as plain text so a malformed entity never silently swallows an alert.
    res = await send({ chat_id: chatId, text });
    if (!res.ok) {
      const err2 = await res.text();
      console.error("[telegram] plain-text retry failed:", err2);
    }
  }
}

export async function notifyAiFailure(
  chatId: string,
  opts: { stage: string; companyName?: string; leadId?: string; error: unknown; snippet?: string },
): Promise<void> {
  if (!chatId) return;
  const errMsg = opts.error instanceof Error ? opts.error.message : String(opts.error);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const lines = [
    `⚠️ <b>AI reply failed — ${escapeHtml(opts.stage)}</b>`,
    opts.companyName ? `Company: ${escapeHtml(opts.companyName)}` : null,
    opts.leadId ? `Lead: <code>${escapeHtml(opts.leadId)}</code>` : null,
    `Error: <code>${escapeHtml(errMsg).slice(0, 400)}</code>`,
    opts.snippet ? `\nInbound: <i>${escapeHtml(opts.snippet.slice(0, 250).replace(/\n/g, " "))}</i>` : null,
    appUrl && opts.leadId ? `\n→ ${appUrl}/inbox` : null,
  ].filter(Boolean) as string[];
  await sendTelegramMessage(chatId, lines.join("\n"));
}
