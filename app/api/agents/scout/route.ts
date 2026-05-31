import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoutGraph } from "@/agents/scout/graph";
import { mapsScoutGraph } from "@/agents/scout/maps-graph";
import { getSystemSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await req.json();
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const [campaign, settings] = await Promise.all([
    db.campaign.findUnique({ where: { id: campaignId } }),
    getSystemSettings(),
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
      campaignId: campaign.id,
      googleMapsApiKey: settings.googleMapsApiKey,
      firecrawlApiKey: settings.firecrawlApiKey ?? "",
      maxPerCity: 60,
    });

    return NextResponse.json({ ok: true, savedCount: result.savedCount });
  }

  if (!settings?.firecrawlApiKey)
    return NextResponse.json({ error: "Firecrawl API key not configured in settings" }, { status: 400 });

  const result = await scoutGraph.invoke({
    query: campaign.query,
    location: campaign.location,
    campaignId: campaign.id,
    firecrawlApiKey: settings.firecrawlApiKey,
    anthropicApiKey: settings.anthropicApiKey ?? "",
  });

  return NextResponse.json({ ok: true, savedCount: result.savedCount });
}
