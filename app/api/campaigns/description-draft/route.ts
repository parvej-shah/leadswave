import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateText } from "@/lib/gemini";

async function getUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    keywords,
    campaignName = "",
    query = "",
    location = "",
    offerType,
  } = (body ?? {}) as {
    keywords?: string;
    campaignName?: string;
    query?: string;
    location?: string;
    offerType?: "website" | "crm";
  };

  if (!keywords || !keywords.trim()) {
    return NextResponse.json({ error: "keywords are required" }, { status: 400 });
  }

  const offerContext =
    offerType === "website"
      ? "This is a WEBSITE-PROPOSAL offer — the target business has NO website yet. The pitch should offer to build them a professional website."
      : offerType === "crm"
      ? "This is a CRM offer — the target business already HAS a website. The pitch should offer a CRM/lead-management system to grow their business."
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
