import { db } from "../lib/db";
import { sendOutboundEmail } from "../lib/email/send";
import { buildOutboundEmail } from "../lib/email/signature";
import { resolveOffer } from "../agents/outreach/lib/offer";
import { buildFollowupPrompt } from "../agents/outreach/lib/opener";
import { stripSignature } from "../lib/html/plain";
import { generateText } from "../lib/gemini";
import { getSystemSettings } from "../lib/settings";

const FOLLOWUP_NUMBER: Record<string, number> = {
  followup_2: 2,
  followup_3: 3,
  followup_4: 4,
};

const FOLLOWUP_FALLBACK: Record<number, string> = {
  2: "Wanted to add one thought — happy to share what's worked for similar pest control businesses if it's useful.",
  3: "No worries if now isn't the right time — out of curiosity, is this something on your radar at all right now?",
  4: "I'll leave it here so I'm not cluttering your inbox. If it's ever worth a look down the line, just reply to this.",
};

async function main() {
  console.log("=== STARTING BATCH DISPATCH (TARGET: 10 FOLLOW-UPS) ===");

  const org = await db.organization.findFirst();
  if (!org) throw new Error("No organization found");

  const settings = await getSystemSettings(org.id);

  // Fetch pending jobs for Pest Control campaign
  const jobs = await db.job.findMany({
    where: {
      status: "pending",
      type: { in: ["followup_2", "followup_3", "followup_4"] },
      lead: {
        orgId: org.id,
        state: "contacted",
        deletedAt: null,
      },
    },
    include: {
      lead: {
        include: {
          campaign: { include: { offers: true } },
          messages: {
            orderBy: { sentAt: "asc" },
            select: { subject: true, body: true, direction: true, sentAt: true },
          },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  console.log(`Found ${jobs.length} total pending follow-up jobs eligible for dispatch.`);

  let sentCount = 0;

  for (const job of jobs) {
    if (sentCount >= 10) {
      console.log("Reached target limit of 10 emails for today. Stopping.");
      break;
    }

    const lead = job.lead;
    if (!lead.email) continue;

    // Check suppression
    const suppressed = await db.suppression.findFirst({
      where: { orgId: org.id, email: lead.email.toLowerCase() },
    });
    if (suppressed) {
      await db.job.update({ where: { id: job.id }, data: { status: "cancelled" } });
      continue;
    }

    const followupNum = FOLLOWUP_NUMBER[job.type] ?? 2;
    const firstSubject =
      lead.messages.find((m) => m.direction === "outbound")?.subject ?? "our outreach";
    const subject = `Re: ${firstSubject}`;

    const priorContext = lead.messages
      .filter((m) => m.direction === "outbound")
      .map((m) => stripSignature(m.body))
      .join("\n\n---\n\n");

    const { offer, angle } = resolveOffer(lead.category, lead.campaign);

    const prompt = buildFollowupPrompt({
      followupNumber: followupNum,
      companyName: lead.companyName,
      angle,
      offer,
      priorOutbound: priorContext,
    });

    let body: string;
    try {
      body = (await generateText(prompt)).trim();
    } catch {
      body = FOLLOWUP_FALLBACK[followupNum] ?? FOLLOWUP_FALLBACK[2];
    }

    const outbound = buildOutboundEmail({
      bodyText: body,
      signatureHtml: settings.signatureHtml,
      signatureText: settings.signatureText || (settings.fromName ? `— ${settings.fromName}` : ""),
    });

    console.log(`[Sending #${sentCount + 1}] To: ${lead.email} (${lead.companyName}) | Job: ${job.type}`);

    const result = await sendOutboundEmail({
      orgId: org.id,
      campaignId: lead.campaignId,
      leadId: lead.id,
      to: lead.email,
      subject,
      html: outbound.html,
      text: outbound.text,
    });

    if (!result.success) {
      if (result.quotaExhausted) {
        console.log("Daily inbox quota exhausted across all inboxes. Stopping dispatch.");
        break;
      }
      console.error(`Failed to send to ${lead.email}:`, result.error);
      continue;
    }

    await db.job.update({ where: { id: job.id }, data: { status: "done" } });
    console.log(`✓ Delivered via ${result.fromEmail} (MessageId: ${result.messageId})`);
    sentCount++;

    // Human pause between sends (1.5s)
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n=== BATCH DISPATCH COMPLETED: ${sentCount} SENT ===`);

  const inboxes = await db.senderInbox.findMany();
  console.log("\n=== Live Inboxes Quota Status ===");
  console.table(inboxes.map(i => ({
    name: i.name,
    fromEmail: i.fromEmail,
    dailyLimit: i.dailyLimit,
    sentToday: i.sentToday,
    isActive: i.isActive
  })));
}

main().catch(console.error);
