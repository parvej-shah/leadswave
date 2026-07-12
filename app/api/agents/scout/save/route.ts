import { NextRequest, NextResponse } from "next/server";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { db } from "@/lib/db";
import { MapsLead } from "@/agents/scout/maps-graph";

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { campaignId, leads } = (await req.json()) as { campaignId: string; leads: MapsLead[] };
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  if (!Array.isArray(leads) || leads.length === 0)
    return NextResponse.json({ error: "leads array required" }, { status: 400 });

  const campaign = await db.campaign.findFirst({ where: { id: campaignId, orgId: ctx.orgId } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const result = await db.lead.createMany({
    data: leads.map((l) => ({
      campaignId,
      orgId: ctx.orgId,
      companyName: l.companyName,
      website: l.website,
      email: l.email,
      emailSource: l.emailSource ?? null,
      emailStatus: l.emailStatus ?? null,
      hasContactForm: l.hasContactForm ?? null,
      facebookUrl: l.facebookUrl ?? null,
      description: l.description,
      category: l.category,
      address: l.address,
      phone: l.phone,
      rating: l.rating,
      mapsUrl: l.mapsUrl,
      placeId: l.placeId,
      score: l.score ?? 0,
      state: "discovered",
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, savedCount: result.count });
}
