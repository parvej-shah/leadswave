import { generateText } from "@/lib/gemini";
import { CLASSIFY_EXAMPLES } from "@/lib/ai/training/inbox-examples";
import { InboxState, Classification, LeadSignals } from "../graph";
import { stripSignature } from "@/lib/html/plain";

function buildFewShotExamples(): string {
  return CLASSIFY_EXAMPLES.map((ex, i) =>
    `Example ${i + 1}:\nReply: "${ex.reply}"\nOutput: {"classification":"${ex.classification}","reasoning":"${ex.reasoning}"}`
  ).join("\n\n");
}

const SYSTEM = `You are an expert B2B email classifier. Your job is to read a cold outreach reply and classify it into exactly one category:

- hot: Clear positive intent. They want to meet, want a demo, said yes, confirmed a slot, asked about pricing, or offered their own available times.
- warm: Interested but not ready. Has questions, wants more info, said maybe, asked for a case study, or needs to check with someone first.
- cold: Not interested. Said no, asked to be removed, unsubscribed, or indicated no fit.
- ooo: Out-of-office auto-reply or vacation message.
- bounce: Email delivery failure, mailer daemon, or invalid address error.

Key rules:
- If they pick a specific slot (option 1/2/3) or say "that works" after slots were proposed → HOT
- If they propose their own time → HOT
- If they say "maybe" or "not sure yet" → WARM, not HOT
- If they ask to unsubscribe or say stop → COLD, never WARM
- Auto-replies with "out of office" → OOO even if they say they'll get back to you

Also extract key signals from their reply in a "signals" JSON object:
- budget_mentioned: boolean
- timeline_mentioned: string or null (e.g. "next month", "Q4")
- competitor_mentioned: string or null (e.g. "Salesforce")
- objection: string or null (e.g. "too expensive", "no capacity")
- contact_name: string or null (e.g. "John")

Use the examples below to calibrate your judgment. Then classify the new reply.`;

export async function classifyNode(state: InboxState): Promise<Partial<InboxState>> {
  const thread = state.priorMessages
    .map((m) => `[${m.direction.toUpperCase()}]${m.subject ? ` Subject: ${m.subject}` : ""}\n${stripSignature(m.body)}`)
    .join("\n\n---\n\n");

  const newReply = [
    `[INBOUND REPLY]`,
    `From: ${state.inboundEmail.from}`,
    state.inboundEmail.subject ? `Subject: ${state.inboundEmail.subject}` : "",
    "",
    state.inboundEmail.body,
  ].filter(Boolean).join("\n");

  const prompt = [
    SYSTEM,
    "",
    "=== FEW-SHOT EXAMPLES ===",
    buildFewShotExamples(),
    "",
    "=== NOW CLASSIFY THIS ===",
    `Company: ${state.lead.companyName}`,
    `Our offer: ${state.campaign.offerText}`,
    "",
    "Full thread context:",
    thread || "(no prior messages — this is the first reply)",
    "",
    newReply,
    "",
    'Respond with ONLY a JSON object: { "classification": "<hot|warm|cold|ooo|bounce>", "reasoning": "<one sentence>", "signals": { "budget_mentioned": false, "timeline_mentioned": null, "competitor_mentioned": null, "objection": null, "contact_name": null } }',
  ].join("\n");

  let classification: Classification = "warm"; // safer default than cold
  let reasoning = "AI unavailable — defaulted to warm for human review";
  let signals: LeadSignals = {};

  try {
    const text = await generateText(prompt);
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        classification: Classification;
        reasoning?: string;
        signals?: LeadSignals;
      };
      const valid: Classification[] = ["hot", "warm", "cold", "ooo", "bounce"];
      if (valid.includes(parsed.classification)) {
        classification = parsed.classification;
        reasoning = parsed.reasoning ?? reasoning;
        signals = parsed.signals ?? {};
      }
    }
  } catch (err) {
    console.error("[classify] AI error:", err);
  }

  console.log(`[classify] ${state.lead.companyName} → ${classification} | ${reasoning}`);
  return { classification, signals };
}
