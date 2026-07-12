import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { generateText } from "@/lib/gemini";

const SIGNAL_CONTEXT: Record<string, string> = {
  no_website: "The target business has NO website yet.",
  has_website: "The target business already HAS a website.",
  always: "",
};

export async function POST(req: NextRequest) {
  try {
    await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const body = await req.json();
  const {
    keywords,
    campaignName = "",
    query = "",
    location = "",
    offerType,
    offerLabel = "",
    matchSignal = "",
  } = (body ?? {}) as {
    keywords?: string;
    campaignName?: string;
    query?: string;
    location?: string;
    /** Legacy two-track hint (older clients). */
    offerType?: "website" | "crm";
    /** User-defined offer: its display label (e.g. "Online booking setup"). */
    offerLabel?: string;
    /** has_website | no_website | always */
    matchSignal?: string;
  };

  if (!keywords || !keywords.trim()) {
    return NextResponse.json({ error: "keywords are required" }, { status: 400 });
  }

  // User-defined offers take precedence; legacy offerType maps onto the same shape.
  const label = offerLabel.trim() || (offerType === "website" ? "Website" : offerType === "crm" ? "CRM" : "");
  const signal = matchSignal || (offerType === "website" ? "no_website" : offerType === "crm" ? "has_website" : "");
  const signalContext = SIGNAL_CONTEXT[signal] ?? "";
  const offerContext = label
    ? `This pitch is for the "${label}" offer. ${signalContext} The pitch should offer exactly that service.`
    : "";

  const prompt = `You write concise cold-outreach offer pitches.
Return only the pitch text (no markdown, no labels, no surrounding quotes).
Length: 1-2 sentences, max 280 characters.
Tone: clear, practical, professional.

Campaign name: ${campaignName}
Business type: ${query}
Location/cities: ${location}
Keywords: ${keywords}
${offerContext ? `\nOffer context: ${offerContext}` : ""}

Write one polished offer pitch:`;

  const draft = await generateText(prompt);
  return NextResponse.json({ draft: draft.trim() });
}
