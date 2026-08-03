import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { generateText } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const body = await req.json();
  const {
    campaignName = "",
    businessType = "",
    offerText = "",
    stepNum = 1,
    variantLabel = "A",
    promptHint = "",
  } = (body ?? {}) as {
    campaignName?: string;
    businessType?: string;
    offerText?: string;
    stepNum?: number;
    variantLabel?: string;
    promptHint?: string;
  };

  const isFollowup = stepNum > 1;

  const prompt = `You are an expert cold email copywriter specializing in high-converting B2B outreach sequences.

Campaign context:
- Campaign name: ${campaignName || "Cold Outreach"}
- Target Niche / Business Type: ${businessType || "B2B SMBs"}
- Service / Offer: ${offerText || "Speed-to-lead & AI Automation"}
- Sequence Step: Step ${stepNum} (${isFollowup ? "Follow-up email" : "Initial cold opener"})
- Variant: ${variantLabel}
${promptHint ? `- Special Instructions: ${promptHint}` : ""}

Rules for email copy:
1. Short, punchy, clear tone. Avoid fluff, cheesy corporate jargon, or fake enthusiasm.
2. Use merge tags: {{firstname}}, {{companyname}}, {{website}}, or {{category}}.
3. Length: Subject under 8 words. Email body between 3 to 6 sentences maximum.
4. End with a soft, low-friction call-to-action (e.g. "Open to a 2-minute video?", "Should I share the quick 1-pager?").

Return ONLY valid JSON matching this exact structure:
{
  "subject": "Email subject line here",
  "body": "Email body paragraphs here with {{firstname}} tags"
}`;

  try {
    const rawOutput = await generateText(prompt);
    // Parse JSON output safely
    const cleanJson = rawOutput.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    return NextResponse.json({
      subject: parsed.subject ?? `{{firstname}}, quick thought for {{companyname}}`,
      body: parsed.body ?? rawOutput,
    });
  } catch (err: any) {
    console.error("[sequence-draft] Gemini error:", err);
    return NextResponse.json({
      subject: `{{firstname}}, a thought for {{companyname}}`,
      body: `Hi {{firstname}},\n\nNoticed {{companyname}}'s work in ${businessType || "your industry"}. Would you be open to a quick 2-minute overview of our ${offerText || "AI automation"} solution?\n\nRegards,\nTeam`,
    });
  }
}
