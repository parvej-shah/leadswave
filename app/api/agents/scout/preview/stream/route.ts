import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { mapsScoutPreviewGraph } from "@/agents/scout/maps-graph";
import { getSystemSettings } from "@/lib/settings";
import { requireOrg, tenantErrorResponse } from "@/lib/tenant";
import { scoutBudgets } from "@/lib/scout-depth";
import { parseSelectedAreas } from "@/agents/scout/lib/areas";

export const maxDuration = 300;

/**
 * Streaming variant of scout preview: emits SSE frames as each LangGraph node
 * completes, so the wizard shows real progress and leads the moment they're
 * ready instead of a blind spinner. Frames:
 *   {type:"progress", node, label, count?}
 *   {type:"leads", leads:[...]}
 *   {type:"done"} | {type:"error", error}
 */
const NODE_LABEL: Record<string, string> = {
  mapsSearch: "Searching Google Maps hotspots…",
  filter: "Filtering places…",
  score: "Scoring lead quality…",
  dedupe: "Removing duplicates & suppressed contacts…",
};

export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (e) {
    return tenantErrorResponse(e);
  }

  const { campaignId } = (await req.json()) as { campaignId?: string };
  if (!campaignId) return Response.json({ error: "campaignId required" }, { status: 400 });

  const [campaign, settings] = await Promise.all([
    db.campaign.findFirst({ where: { id: campaignId, orgId: ctx.orgId }, include: { offers: true } }),
    getSystemSettings(ctx.orgId),
  ]);
  if (!campaign) return Response.json({ error: "Campaign not found" }, { status: 404 });
  if (!settings?.googleMapsApiKey)
    return Response.json({ error: "Google Maps API key not configured in settings" }, { status: 400 });
  if (campaign.selectedCities.length === 0)
    return Response.json({ error: "Campaign has no selected cities" }, { status: 400 });

  const input = {
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
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        send({ type: "progress", node: "start", label: "Starting scout…" });
        for await (const update of await mapsScoutPreviewGraph.stream(input, {
          streamMode: "updates",
        })) {
          for (const [node, partial] of Object.entries(update) as [string, Record<string, unknown>][]) {
            const leads = partial?.leads as unknown[] | undefined;
            const places = partial?.places as unknown[] | undefined;
            send({
              type: "progress",
              node,
              label: NODE_LABEL[node] ?? node,
              count: leads?.length ?? places?.length,
            });
            // dedupe is the preview graph's last node — its leads are final
            if (node === "dedupe" && Array.isArray(leads)) {
              send({ type: "leads", leads });
            }
          }
        }
        send({ type: "done" });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Scout failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
