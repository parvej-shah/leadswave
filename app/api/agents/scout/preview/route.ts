import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapsScoutPreviewGraph } from "@/agents/scout/maps-graph";
import { getSystemSettings } from "@/lib/settings";
import { parseSelectedAreas, SelectedAreas } from "@/agents/scout/lib/areas";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId, cities: citiesOverride, areas: areasOverride } = (await req.json()) as {
    campaignId?: string;
    cities?: string[];
    areas?: Record<string, string[]>;
  };
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const [campaign, settings] = await Promise.all([
    db.campaign.findUnique({ where: { id: campaignId } }),
    getSystemSettings(),
  ]);

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!settings?.googleMapsApiKey)
    return NextResponse.json({ error: "Google Maps API key not configured in settings" }, { status: 400 });

  // Allow caller to pass cities directly (e.g. re-scout for old campaigns with no saved cities)
  const citiesToUse: string[] = citiesOverride?.length ? citiesOverride : campaign.selectedCities;

  if (citiesToUse.length === 0)
    return NextResponse.json({ error: "Campaign has no selected cities" }, { status: 400 });

  // Areas: explicit override wins; otherwise use the campaign's stored areas,
  // filtered to the cities actually being searched (stale areas for dropped cities are ignored).
  const storedAreas = parseSelectedAreas(campaign.selectedAreas);
  const areasToUse: SelectedAreas = {};
  const source = areasOverride ? parseSelectedAreas(areasOverride) : storedAreas;
  for (const city of citiesToUse) {
    if (source[city]?.length) areasToUse[city] = source[city];
  }

  const result = await mapsScoutPreviewGraph.invoke({
    businessType: campaign.businessType ?? campaign.query,
    country: campaign.country ?? "",
    selectedCities: citiesToUse,
    selectedAreas: areasToUse,
    campaignId: campaign.id,
    googleMapsApiKey: settings.googleMapsApiKey,
    firecrawlApiKey: settings.firecrawlApiKey ?? "",
    maxPerCity: 300,
  });

  return NextResponse.json({ leads: result.leads });
}
