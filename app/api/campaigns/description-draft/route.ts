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
  } = (body ?? {}) as {
    keywords?: string;
    campaignName?: string;
    query?: string;
    location?: string;
  };

  if (!keywords || !keywords.trim()) {
    return NextResponse.json({ error: "keywords are required" }, { status: 400 });
  }

  const prompt = `You write concise outreach campaign descriptions.
Return only the description text (no markdown, no labels, no surrounding quotes).
Length: 1-2 sentences, max 280 characters.
Tone: clear, practical, professional.

Campaign name: ${campaignName}
Query: ${query}
Location: ${location}
Keywords: ${keywords}

Write one polished campaign offer description:`;

  const draft = await generateText(prompt);
  return NextResponse.json({ draft: draft.trim() });
}
