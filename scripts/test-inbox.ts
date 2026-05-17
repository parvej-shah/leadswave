import { inboxGraph } from "../agents/inbox/graph";
import { db } from "../lib/db";

async function main() {
  const leadId = process.argv[2] ?? "cmp5rhdcm0001oq14xxq2ztm0";
  const body = process.argv[3] ?? "Yes I'm interested, let's hop on a call. When are you free?";

  // Persist inbound message so load_context picks it up as prior messages
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { email: true } });
  await db.message.create({
    data: {
      leadId,
      direction: "inbound",
      subject: "Re: Quick question about your outreach",
      body,
    },
  });

  console.log(`\nTesting inbox agent with lead: ${leadId}`);
  console.log(`Simulated reply: "${body}"\n`);

  const result = await inboxGraph.invoke({
    leadId,
    inboundEmail: {
      from: lead?.email ?? "unknown@example.com",
      subject: "Re: Quick question about your outreach",
      body,
      inReplyTo: null,
    },
    anthropicApiKey: "",
    telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  });

  console.log("classification:", result.classification);
  console.log("draftReply:", result.draftReply ?? "(none)");
  console.log("lead state:", result.lead?.state);
}

main().catch(e => { console.error(e.message); process.exit(1); });
