import { db } from "../lib/db";

async function main() {
  const s = await db.settings.findFirst({
    select: {
      googleClientId: true,
      googleClientSecret: true,
      googleRefreshToken: true,
      calendarId: true,
      telegramChatId: true,
      fromEmail: true,
      fromName: true,
      resendApiKey: true,
    },
  });
  console.log(JSON.stringify({
    googleClientId: s?.googleClientId ? s.googleClientId.slice(0, 20) + "..." : null,
    googleClientSecret: s?.googleClientSecret ? "SET" : null,
    googleRefreshToken: s?.googleRefreshToken ? "SET (" + s.googleRefreshToken.slice(0, 10) + "...)" : null,
    calendarId: s?.calendarId,
    telegramChatId: s?.telegramChatId,
    fromEmail: s?.fromEmail,
    fromName: s?.fromName,
    resendApiKey: s?.resendApiKey ? "SET" : null,
  }, null, 2));
}
main().catch(e => { console.error(e.message); process.exit(1); });
