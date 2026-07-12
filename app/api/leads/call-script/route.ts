import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";
import { generateText } from "@/lib/gemini";
import { resolveOffer } from "@/agents/outreach/lib/offer";

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
    include: { campaign: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const { offer, angle } = resolveOffer(lead.category, lead.campaign);

  const prompt = `Write a short phone call script for a salesperson cold-calling a local business.
Business: ${lead.companyName}${lead.address ? ` (${lead.address})` : ""}
${angle ? `Pitch angle: ${angle}\n` : ""}Our offer: ${offer}

Rules:
- Conversational and natural, the way a real person talks on the phone — not a formal letter.
- Structure: a one-line opener, one line on why we're calling (the offer), and one line asking for a quick next step.
- Max ~5 short sentences total. No markdown, no headings, no stage directions.
Return the script text only.`;

  try {
    const script = (await generateText(prompt)).trim();
    return NextResponse.json({ script, phone: lead.phone });
  } catch {
    return NextResponse.json({ error: "Failed to generate call script" }, { status: 502 });
  }
}
