import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { MapsScoutState } from "../maps-graph";

export async function mapsSaveNode(state: MapsScoutState): Promise<Partial<MapsScoutState>> {
  if (state.leads.length === 0) return { savedCount: 0 };

  const result = await db.lead.createMany({
    data: state.leads.map((l) => ({
      campaignId: state.campaignId,
      orgId: state.orgId,
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
      latitude: l.lat,
      longitude: l.lng,
      score: l.score,
      state: "discovered",
    })),
    skipDuplicates: true,
  });

  await logActivity({
    orgId: state.orgId,
    type: "scouted",
    campaignId: state.campaignId,
    summary: `Scouted ${result.count} new lead${result.count === 1 ? "" : "s"}`,
  });

  return { savedCount: result.count };
}
