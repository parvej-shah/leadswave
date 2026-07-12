import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";
import { generateText } from "@/lib/gemini";
import { stripSignature } from "@/lib/html/plain";

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const lead = await db.lead.findFirst({
    where: { id: leadId, orgId: ctx.orgId },
    include: {
      campaign: { select: { offerText: true, name: true } },
      messages: {
        orderBy: { sentAt: "asc" },
        select: { direction: true, body: true, subject: true },
      },
    },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const latestInbound = [...lead.messages].reverse().find((m) => m.direction === "inbound");
  if (!latestInbound?.body?.trim()) {
    return NextResponse.json({ error: "No inbound message found to draft from" }, { status: 400 });
  }

  const thread = lead.messages
    .filter((m) => m.direction !== "system")
    .slice(-8)
    .map((m) => `[${m.direction.toUpperCase()}]${m.subject ? ` ${m.subject}` : ""}\n${stripSignature(m.body)}`)
    .join("\n\n---\n\n");

  const prompt = `You write short, human B2B email replies.
Return only the email body text, no subject line and no markdown.

Lead company: ${lead.companyName}
Campaign: ${lead.campaign.name}
Offer: ${lead.campaign.offerText}

Thread context:
${thread}

Write a concise reply to their latest inbound message.
Rules:
- 2 to 4 short sentences.
- Friendly and confident, not robotic.
- If they seem ready, suggest next-step confirmation.
- No overpromising or fake claims.
- Use correct grammar, spelling, and punctuation throughout.
- No signature.`;

  try {
    const draft = await generateText(prompt);
    if (!draft.trim()) throw new Error("Empty draft");
    return NextResponse.json({ draft: draft.trim() });
  } catch (err) {
    return NextResponse.json({ error: `Draft generation failed: ${String(err)}` }, { status: 502 });
  }
}
