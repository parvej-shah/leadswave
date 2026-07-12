import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { generateText } from "@/lib/gemini";
import { resolveOffer } from "@/agents/outreach/lib/offer";
import { buildFollowupPrompt } from "@/agents/outreach/lib/opener";
import { stripSignature } from "@/lib/html/plain";

const FOLLOWUP_NUMBER: Record<string, number> = {
  followup_2: 2,
  followup_3: 3,
  followup_4: 4,
};

/**
 * Preview what this follow-up will say — the exact same drafting path the cron
 * uses (offer resolution + prior-thread context), just without sending.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/jobs/[id]/preview">) {
  let org;
  try {
    org = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { id } = await ctx.params;
  const job = await db.job.findFirst({
    where: { id, status: "pending", lead: { orgId: org.orgId } },
    include: {
      lead: {
        include: {
          campaign: { include: { offers: true } },
          messages: {
            orderBy: { sentAt: "asc" },
            select: { subject: true, body: true, direction: true },
          },
        },
      },
    },
  });
  if (!job) return NextResponse.json({ error: "Pending job not found" }, { status: 404 });

  if (job.overrideBody?.trim()) {
    return NextResponse.json({ body: job.overrideBody, source: "override" });
  }

  const lead = job.lead;
  const followupNum = FOLLOWUP_NUMBER[job.type] ?? 2;
  const priorContext = lead.messages
    .filter((m) => m.direction === "outbound")
    .map((m) => stripSignature(m.body))
    .join("\n\n---\n\n");
  const { offer, angle } = resolveOffer(lead.category, lead.campaign);

  const prompt = buildFollowupPrompt({
    followupNumber: followupNum,
    companyName: lead.companyName,
    angle,
    offer,
    priorOutbound: priorContext,
  });

  try {
    const body = (await generateText(prompt)).trim();
    if (!body) throw new Error("empty draft");
    return NextResponse.json({ body, source: "ai" });
  } catch {
    return NextResponse.json({ error: "Draft generation failed — try again" }, { status: 502 });
  }
}
