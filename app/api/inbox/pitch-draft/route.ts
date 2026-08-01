import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";
import { generateText } from "@/lib/gemini";
import { resolveOffer } from "@/agents/outreach/lib/offer";
import { stripSignature } from "@/lib/html/plain";

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const body = await req.json().catch(() => ({}));
  const { leadId } = body as { leadId?: string };

  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }

  const lead = await db.lead.findFirst({
    where: { id: leadId, orgId: ctx.orgId, deletedAt: null },
    include: {
      campaign: {
        include: {
          offers: { orderBy: { order: "asc" } },
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        select: { direction: true, body: true },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.state !== "replied") {
    return NextResponse.json(
      { error: "Lead is not in a replied state" },
      { status: 400 },
    );
  }

  const { offer, angle } = resolveOffer(lead.category, lead.campaign);

  const thread = lead.messages
    .map((m) => `[${m.direction.toUpperCase()}] ${stripSignature(m.body)}`)
    .join("\n\n---\n\n");

  const prompt = `You are drafting a full pitch response for a HOT lead on behalf of a B2B sales rep.
The lead has shown interest or intent to meet.
Write a clear, confident, 4-5 sentence reply:
1. Acknowledge what they said, make it personal.
2. Describe specifically what we do for businesses like theirs (one concrete outcome, no hype).
3. End with a clear call-to-action (propose a 20-minute call with 2-3 available time slots).

Company: ${lead.companyName}
Our specific offer for them: ${offer}
${angle ? `Angle / Context: ${angle}\n` : ""}

Thread so far:
${thread}

Return ONLY the email body text — no subject, no greeting/sign-off needed.`;

  try {
    const draft = await generateText(prompt);
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("[pitch-draft] AI generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate pitch draft" },
      { status: 500 },
    );
  }
}
