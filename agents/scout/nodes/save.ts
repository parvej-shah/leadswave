import { db } from "@/lib/db";
import { ScoutState } from "../graph";

export async function saveNode(state: ScoutState): Promise<Partial<ScoutState>> {
  if (state.leads.length === 0) return { savedCount: 0 };

  await db.lead.createMany({
    data: state.leads.map((l) => ({
      campaignId: state.campaignId,
      orgId: state.orgId,
      companyName: l.companyName,
      website: l.website ?? null,
      email: l.email ?? null,
      description: l.description ?? null,
      state: "discovered",
    })),
    skipDuplicates: true,
  });

  return { savedCount: state.leads.length };
}
