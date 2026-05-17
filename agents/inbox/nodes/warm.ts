import { generateText } from "@/lib/gemini";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { InboxState } from "../graph";

export async function warmNode(state: InboxState): Promise<Partial<InboxState>> {
  await db.lead.update({
    where: { id: state.leadId },
    data: { state: "replied", lastTouchedAt: new Date() },
  });

  await db.job.updateMany({
    where: { leadId: state.leadId, status: "pending" },
    data: { status: "cancelled" },
  });

  const thread = state.priorMessages
    .map((m) => `[${m.direction.toUpperCase()}] ${m.body}`)
    .join("\n\n---\n\n");

  const prompt = `You are drafting a brief, warm follow-up reply on behalf of a B2B sales rep.
Write 2-3 sentences. Be helpful, not salesy. Match the tone of their reply.
Return ONLY the email body text — no subject, no greeting/sign-off needed.

Company: ${state.lead.companyName}
Our offer: ${state.campaign.offerText}

Thread so far:
${thread}

Their latest reply:
${state.inboundEmail.body}`;

  const draftReply = await generateText(prompt).catch(() => null);

  if (draftReply) {
    await db.message.create({
      data: {
        leadId: state.leadId,
        direction: "system",
        subject: `Draft reply to: ${state.inboundEmail.subject}`,
        body: draftReply,
      },
    });
  }

  if (state.telegramChatId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    await sendTelegramMessage(
      state.telegramChatId,
      `💬 <b>${state.lead.companyName} has a question</b>\nDraft reply ready for approval → ${appUrl}/leads`,
    );
  }

  return { draftReply };
}
