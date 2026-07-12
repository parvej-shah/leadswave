import { db } from "@/lib/db";
import { ScoutState } from "../graph";

export async function dedupeNode(state: ScoutState): Promise<Partial<ScoutState>> {
  if (state.leads.length === 0) return { leads: [] };

  const emails = state.leads
    .map((l) => l.email)
    .filter((e): e is string => !!e);

  const suppressed = await db.suppression.findMany({
    where: { orgId: state.orgId, email: { in: emails } },
    select: { email: true },
  });
  const suppressedSet = new Set(suppressed.map((s) => s.email));

  const existingLeads = await db.lead.findMany({
    where: {
      campaignId: state.campaignId,
      email: { in: emails },
      deletedAt: null,
    },
    select: { email: true },
  });
  const existingSet = new Set(existingLeads.map((l) => l.email).filter(Boolean));

  const leads = state.leads.filter((l) => {
    if (!l.email) return true;
    return !suppressedSet.has(l.email) && !existingSet.has(l.email);
  });

  return { leads };
}
