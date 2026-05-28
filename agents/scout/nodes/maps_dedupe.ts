import { db } from "@/lib/db";
import { MapsScoutState } from "../maps-graph";

export async function mapsDedupeNode(state: MapsScoutState): Promise<Partial<MapsScoutState>> {
  if (state.leads.length === 0) return { leads: [] };

  const placeIds = state.leads.map((l) => l.placeId);
  const emails = state.leads.map((l) => l.email).filter((e): e is string => !!e);

  const [existingByPlace, existingByEmail, suppressed] = await Promise.all([
    db.lead.findMany({
      where: { campaignId: state.campaignId, placeId: { in: placeIds } },
      select: { placeId: true },
    }),
    emails.length
      ? db.lead.findMany({
          where: { campaignId: state.campaignId, email: { in: emails }, deletedAt: null },
          select: { email: true },
        })
      : Promise.resolve([] as { email: string | null }[]),
    emails.length
      ? db.suppression.findMany({ where: { email: { in: emails } }, select: { email: true } })
      : Promise.resolve([] as { email: string }[]),
  ]);

  const existingPlaceSet = new Set(existingByPlace.map((l) => l.placeId).filter(Boolean));
  const existingEmailSet = new Set(existingByEmail.map((l) => l.email).filter(Boolean));
  const suppressedSet = new Set(suppressed.map((s) => s.email));

  const leads = state.leads.filter((l) => {
    if (existingPlaceSet.has(l.placeId)) return false;
    if (l.email && (existingEmailSet.has(l.email) || suppressedSet.has(l.email))) return false;
    return true;
  });

  return { leads };
}
