import { Resend } from "resend";
import { db } from "@/lib/db";
import { OutreachState } from "../graph";

export async function sendNode(state: OutreachState): Promise<Partial<OutreachState>> {
  if (!state.lead.email) throw new Error(`Lead ${state.leadId} has no email address`);
  if (!state.resendApiKey) throw new Error("Resend API key not configured in settings");
  if (!state.fromEmail) throw new Error("From email not configured in settings");

  const resend = new Resend(state.resendApiKey);

  const { data, error } = await resend.emails.send({
    from: state.fromName ? `${state.fromName} <${state.fromEmail}>` : state.fromEmail,
    to: state.lead.email,
    subject: state.emailDraft.subject,
    text: state.emailDraft.body,
  });

  if (error) throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`);
  console.log("[send] Resend accepted:", data?.id);

  await db.message.create({
    data: {
      leadId: state.leadId,
      direction: "outbound",
      subject: state.emailDraft.subject,
      body: state.emailDraft.body,
    },
  });

  await db.lead.update({
    where: { id: state.leadId },
    data: { state: "contacted", lastTouchedAt: new Date() },
  });

  return { sent: true };
}
