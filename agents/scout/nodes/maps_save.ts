import { db } from "@/lib/db";
import { MapsScoutState } from "../maps-graph";

export async function mapsSaveNode(state: MapsScoutState): Promise<Partial<MapsScoutState>> {
  if (state.leads.length === 0) return { savedCount: 0 };

  const result = await db.lead.createMany({
    data: state.leads.map((l) => ({
      campaignId: state.campaignId,
      companyName: l.companyName,
      website: l.website,
      email: l.email,
      description: l.description,
      category: l.category,
      address: l.address,
      phone: l.phone,
      rating: l.rating,
      mapsUrl: l.mapsUrl,
      placeId: l.placeId,
      score: l.score,
      state: "discovered",
    })),
    skipDuplicates: true,
  });

  return { savedCount: result.count };
}
