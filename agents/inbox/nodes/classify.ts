import { generateText } from "@/lib/gemini";
import { InboxState, Classification } from "../graph";

const SYSTEM = `You are an email classifier for a B2B cold outreach system.
Classify the reply into exactly one category:
- hot: positive intent, wants to meet, asking for price/demo, "yes", "interested", "let's talk"
- warm: has a question, not ready yet, "maybe", "send more info", "follow up in X weeks"
- cold: not interested, "no thanks", "stop emailing", "remove me", "unsubscribe"
- ooo: auto-reply, out of office, vacation message
- bounce: delivery failure, mailer daemon, no-such-user

Respond with a JSON object: { "classification": "<one of the above>", "reasoning": "<one sentence>" }`;

export async function classifyNode(state: InboxState): Promise<Partial<InboxState>> {
  const thread = state.priorMessages
    .map((m) => `[${m.direction.toUpperCase()}] ${m.subject ? `Subject: ${m.subject}\n` : ""}${m.body}`)
    .join("\n\n---\n\n");

  const newReply = `[INBOUND REPLY]\nFrom: ${state.inboundEmail.from}\nSubject: ${state.inboundEmail.subject}\n\n${state.inboundEmail.body}`;

  const prompt = [
    SYSTEM,
    "",
    `Company: ${state.lead.companyName}`,
    `Offer: ${state.campaign.offerText}`,
    "",
    "Prior thread:",
    thread || "(no prior messages)",
    "",
    newReply,
  ].join("\n");

  let classification: Classification = "cold";
  try {
    const text = await generateText(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { classification: Classification };
      const valid: Classification[] = ["hot", "warm", "cold", "ooo", "bounce"];
      if (valid.includes(parsed.classification)) {
        classification = parsed.classification;
      }
    }
  } catch {
    // default to cold on failure
  }

  return { classification };
}
