import TelegramBot from "node-telegram-bot-api";

let bot: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN ?? "", {
      polling: false,
    });
  }
  return bot;
}

export async function sendTelegram(message: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId || !process.env.TELEGRAM_BOT_TOKEN) return;
  await getBot().sendMessage(chatId, message, { parse_mode: "Markdown" });
}
