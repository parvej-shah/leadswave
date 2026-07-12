import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoutGraph } from "@/agents/scout/graph";
import { mapsScoutGraph } from "@/agents/scout/maps-graph";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { scoutBudgets } from "@/lib/scout-depth";
import { parseSelectedAreas } from "@/agents/scout/lib/areas";

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { campaignId } = await req.json();
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const [campaign, settings] = await Promise.all([
    db.campaign.findFirst({ where: { id: campaignId, orgId: ctx.orgId }, include: { offers: true } }),
    getSystemSettings(ctx.orgId),
  ]);


  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  await db.campaign.update({ where: { id: campaignId }, data: { status: "active" } });

  if (campaign.selectedCities.length > 0) {
    if (!settings?.googleMapsApiKey)
      return NextResponse.json({ error: "Google Maps API key not configured in settings" }, { status: 400 });

    const result = await mapsScoutGraph.invoke({
      businessType: campaign.businessType ?? campaign.query,
      country: campaign.country ?? "",
      selectedCities: campaign.selectedCities,
      selectedAreas: parseSelectedAreas(campaign.selectedAreas),
      campaignId: campaign.id,
      orgId: ctx.orgId,
      offers: campaign.offers,
      googleMapsApiKey: settings.googleMapsApiKey,
      firecrawlApiKey: settings.firecrawlApiKey ?? "",
      ...scoutBudgets(campaign.scoutDepth),
    });

    return NextResponse.json({ ok: true, savedCount: result.savedCount });
  }

  if (!settings?.firecrawlApiKey)
    return NextResponse.json({ error: "Firecrawl API key not configured in settings" }, { status: 400 });

  const result = await scoutGraph.invoke({
    query: campaign.query,
    location: campaign.location,
    campaignId: campaign.id,
    orgId: ctx.orgId,
    firecrawlApiKey: settings.firecrawlApiKey,
    anthropicApiKey: settings.anthropicApiKey ?? "",
  });

  return NextResponse.json({ ok: true, savedCount: result.savedCount });
}
