import { generateText } from "@/lib/gemini";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { sendTelegramMessage, notifyAiFailure, escapeHtml } from "@/lib/telegram";
import { InboxState } from "../graph";
import { stripSignature } from "@/lib/html/plain";

export async function warmNode(state: InboxState): Promise<Partial<InboxState>> {
  await logActivity({
    orgId: state.lead.orgId,
    type: "reply_warm",
    leadId: state.leadId,
    summary: `Classified reply from ${state.lead.companyName} as warm`,
  });

  await db.lead.update({
    where: { id: state.leadId },
    data: { state: "replied", lastTouchedAt: new Date() },
  });

  await db.job.updateMany({
    where: { leadId: state.leadId, status: "pending" },
    data: { status: "cancelled" },
  });

  const thread = state.priorMessages
    .map((m) => `[${m.direction.toUpperCase()}] ${stripSignature(m.body)}`)
    .join("\n\n---\n\n");

  const prompt = `You are drafting a brief, warm follow-up reply on behalf of a B2B sales rep.
Write 2-3 sentences. Be helpful, not salesy. Match the tone of their reply.
Use correct grammar, spelling, and punctuation throughout.
Return ONLY the email body text — no subject, no greeting/sign-off needed.

Company: ${state.lead.companyName}
Our offer: ${state.campaign.offerText}

Thread so far:
${thread}

Their latest reply:
${state.inboundEmail.body}`;

  let draftReply: string | null = null;
  try {
    draftReply = await generateText(prompt);
  } catch (err) {
    console.error("[warm] AI draft failed:", err);
    if (state.telegramChatId) {
      await notifyAiFailure(state.telegramChatId, {
        stage: "warm draft",
        companyName: state.lead.companyName,
        leadId: state.leadId,
        error: err,
        snippet: state.inboundEmail.body,
      });
    }
  }

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

  if (state.telegramChatId && !state.notifyHotOnly) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    await sendTelegramMessage(
      state.telegramChatId,
      `💬 <b>${escapeHtml(state.lead.companyName)} has a question</b>\nDraft reply ready for approval → ${appUrl}/leads`,
    );
  }

  return { draftReply };
}
