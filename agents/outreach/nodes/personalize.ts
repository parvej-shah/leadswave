import { generateText } from "@/lib/gemini";
import { OutreachState } from "../graph";
import { resolveOffer } from "../lib/offer";
import { resolveLanguage } from "../lib/locale";
import { buildEmailOpenerPrompt } from "../lib/opener";

export async function personalizeNode(state: OutreachState): Promise<Partial<OutreachState>> {
  const { offer, angle } = resolveOffer(state.lead.category, state.campaign);
  const language = resolveLanguage(state.campaign.country);

  const prompt = buildEmailOpenerPrompt(
    {
      fromName: state.fromName,
      companyName: state.lead.companyName,
      websiteSummary: state.websiteSummary || state.lead.description,
      location: state.lead.address,
      angle,
      offer,
    },
    { language },
  );

  const text = await generateText(prompt);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini did not return valid JSON for email draft");

  const { subject, body } = JSON.parse(jsonMatch[0]);
  return { emailDraft: { subject, body } };
}
