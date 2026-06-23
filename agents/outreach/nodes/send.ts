import { Resend } from "resend";
import { db } from "@/lib/db";
import { OutreachState } from "../graph";
import { appendOpenerSignature } from "@/lib/email/signature";

export async function sendNode(state: OutreachState): Promise<Partial<OutreachState>> {
  if (!state.lead.email) throw new Error(`Lead ${state.leadId} has no email address`);
  if (state.lead.emailStatus === "invalid")
    throw new Error(`Lead ${state.leadId} email failed verification — skipping to protect sender reputation`);
  if (!state.resendApiKey) throw new Error("Resend API key not configured in settings");
  if (!state.fromEmail) throw new Error("From email not configured in settings");

  const resend = new Resend(state.resendApiKey);

  // First-touch opener: permanent signature, but plain text + URLs stripped
  // (opener invariant forbids links in message #1). We send AND store the signed
  // text so the thread viewer shows exactly what the recipient received; the AI
  // follow-up prior-context prompt strips the signature back off (stripSignature).
  const sentText = appendOpenerSignature(
    state.emailDraft.body,
    state.signatureText,
    state.signatureHtml,
  );

  const { data, error } = await resend.emails.send({
    from: state.fromName ? `${state.fromName} <${state.fromEmail}>` : state.fromEmail,
    to: state.lead.email,
    subject: state.emailDraft.subject,
    text: sentText,
  });

  if (error) throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`);
  console.log("[send] Resend accepted:", data?.id);

  await db.message.create({
    data: {
      leadId: state.leadId,
      direction: "outbound",
      subject: state.emailDraft.subject,
      body: sentText,
      resendId: data?.id ?? null,
      deliveryStatus: "sent",
    },
  });

  await db.lead.update({
    where: { id: state.leadId },
    data: { state: "contacted", lastTouchedAt: new Date() },
  });

  return { sent: true };
}
