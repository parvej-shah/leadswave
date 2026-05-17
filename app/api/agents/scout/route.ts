import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoutGraph } from "@/agents/scout/graph";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { campaignId } = await req.json();
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const [campaign, settings] = await Promise.all([
    db.campaign.findUnique({ where: { id: campaignId } }),
    db.settings.findUnique({ where: { userId } }),
  ]);

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!settings?.firecrawlApiKey)
    return NextResponse.json({ error: "Firecrawl API key not configured in settings" }, { status: 400 });

  await db.campaign.update({ where: { id: campaignId }, data: { status: "active" } });

  const result = await scoutGraph.invoke({
    query: campaign.query,
    location: campaign.location,
    campaignId: campaign.id,
    firecrawlApiKey: settings.firecrawlApiKey,
    anthropicApiKey: settings.anthropicApiKey ?? "",
  });

  return NextResponse.json({ ok: true, savedCount: result.savedCount });
}
