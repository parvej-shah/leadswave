import { db } from "@/lib/db";
import { OutreachState } from "../graph";
import { appendOpenerSignature } from "@/lib/email/signature";
import { sendsDisabled, dryRunSend } from "@/lib/email/guard";
import { sendOutboundEmail } from "@/lib/email/send";
import { logActivity } from "@/lib/activity";

export async function sendNode(state: OutreachState): Promise<Partial<OutreachState>> {
  if (!state.lead.email) throw new Error(`Lead ${state.leadId} has no email address`);
  if (state.lead.emailStatus === "invalid")
    throw new Error(`Lead ${state.leadId} email failed verification — skipping to protect sender reputation`);

  // First-touch opener: permanent signature, but plain text + URLs stripped
  // (opener invariant forbids links in message #1). We send AND store the signed
  // text so the thread viewer shows exactly what the recipient received; the AI
  // follow-up prior-context prompt strips the signature back off (stripSignature).
  const sentText = appendOpenerSignature(
    state.emailDraft.body,
    state.signatureText,
    state.signatureHtml,
  );

  const result = sendsDisabled()
    ? { success: true, messageId: "dry-run" }
    : await sendOutboundEmail({
        orgId: state.lead.orgId,
        campaignId: state.lead.campaignId,
        leadId: state.leadId,
        to: state.lead.email,
        subject: state.emailDraft.subject,
        text: sentText,
      });

  if (!result.success) throw new Error(`Outbound send error: ${result.error}`);

  await logActivity({
    orgId: state.lead.orgId,
    type: "opener_sent",
    leadId: state.leadId,
    campaignId: state.lead.campaignId,
    summary: `Sent opener to ${state.lead.companyName}`,
  });

  return { sent: true };
}
