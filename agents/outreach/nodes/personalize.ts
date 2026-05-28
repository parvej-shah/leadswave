import { generateText } from "@/lib/gemini";
import { OutreachState } from "../graph";
import { resolveOffer } from "../lib/offer";

export async function personalizeNode(state: OutreachState): Promise<Partial<OutreachState>> {
  const { offer, angle } = resolveOffer(state.lead.category, state.campaign);

  const prompt = `You are writing a cold outreach email on behalf of ${state.fromName || "our team"}.

About the recipient company:
${state.websiteSummary || state.lead.description || `Company: ${state.lead.companyName}`}
${angle ? `\nPitch angle: ${angle}\n` : ""}
Our offer:
${offer}

Write a short, personalized cold email. Rules:
- Subject line: concise, no clickbait, references something specific about their business
- Body: max 3 sentences. One sentence on what caught our attention about them, one on what we offer, one clear CTA (a 15-min call)
- Conversational tone, no hype words, no "I hope this email finds you well"
- Sign off as: ${state.fromName || "The team"}

Return JSON only:
{ "subject": "...", "body": "..." }`;

  const text = await generateText(prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini did not return valid JSON for email draft");

  const { subject, body } = JSON.parse(jsonMatch[0]);
  return { emailDraft: { subject, body } };
}
