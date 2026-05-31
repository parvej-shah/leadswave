import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapsScoutPreviewGraph } from "@/agents/scout/maps-graph";
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
  if (campaign.selectedCities.length === 0)
    return NextResponse.json({ error: "Campaign has no selected cities" }, { status: 400 });
  if (!settings?.googleMapsApiKey)
    return NextResponse.json({ error: "Google Maps API key not configured in settings" }, { status: 400 });

  const result = await mapsScoutPreviewGraph.invoke({
    businessType: campaign.businessType ?? campaign.query,
    country: campaign.country ?? "",
    selectedCities: campaign.selectedCities,
    campaignId: campaign.id,
    googleMapsApiKey: settings.googleMapsApiKey,
    firecrawlApiKey: settings.firecrawlApiKey ?? "",
    maxPerCity: 60,
  });

  return NextResponse.json({ leads: result.leads });
}
