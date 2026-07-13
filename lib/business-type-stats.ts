import { db } from "@/lib/db";

export type BusinessTypeStat = {
  id: string;
  name: string;
  defaultOffer: string | null;
  campaignCount: number;
  leads: number;
  contacted: number;
  replied: number;
  meetings: number;
  contactedPct: number;
  /** leads with coordinates / total leads — how much of this type's book is mappable */
  mappedPct: number;
};

const CONTACTED_STATES = new Set(["contacted", "replied", "converted", "meeting_booked"]);
const REPLIED_STATES = new Set(["replied", "converted", "meeting_booked"]);

/**
 * Per-business-type rollup for an org: campaign count + lead pipeline stats.
 * Shared by the Business Types page and the grouped campaigns list so both
 * views agree. One campaigns query, one leads query — no N+1.
 */
export async function getBusinessTypeStats(orgId: string): Promise<BusinessTypeStat[]> {
  const [types, campaigns, leads] = await Promise.all([
    db.businessType.findMany({
      where: { orgId },
      select: { id: true, name: true, defaultOffer: true },
      orderBy: { name: "asc" },
    }),
    db.campaign.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, businessTypeId: true },
    }),
    db.lead.findMany({
      where: { orgId, deletedAt: null },
      select: { campaignId: true, state: true, latitude: true },
    }),
  ]);

  // campaignId -> businessTypeId
  const campaignType = new Map<string, string | null>();
  const typeCampaignCount = new Map<string, number>();
  for (const c of campaigns) {
    campaignType.set(c.id, c.businessTypeId);
    if (c.businessTypeId) {
      typeCampaignCount.set(c.businessTypeId, (typeCampaignCount.get(c.businessTypeId) ?? 0) + 1);
    }
  }

  const acc = new Map<
    string,
    { leads: number; contacted: number; replied: number; meetings: number; mapped: number }
  >();
  const bump = (typeId: string) => {
    let a = acc.get(typeId);
    if (!a) {
      a = { leads: 0, contacted: 0, replied: 0, meetings: 0, mapped: 0 };
      acc.set(typeId, a);
    }
    return a;
  };

  for (const l of leads) {
    const typeId = campaignType.get(l.campaignId);
    if (!typeId) continue;
    const a = bump(typeId);
    a.leads++;
    if (CONTACTED_STATES.has(l.state)) a.contacted++;
    if (REPLIED_STATES.has(l.state)) a.replied++;
    if (l.state === "meeting_booked") a.meetings++;
    if (l.latitude != null) a.mapped++;
  }

  return types.map((t) => {
    const a = acc.get(t.id) ?? { leads: 0, contacted: 0, replied: 0, meetings: 0, mapped: 0 };
    return {
      id: t.id,
      name: t.name,
      defaultOffer: t.defaultOffer,
      campaignCount: typeCampaignCount.get(t.id) ?? 0,
      leads: a.leads,
      contacted: a.contacted,
      replied: a.replied,
      meetings: a.meetings,
      contactedPct: a.leads ? Math.round((a.contacted / a.leads) * 100) : 0,
      mappedPct: a.leads ? Math.round((a.mapped / a.leads) * 100) : 0,
    };
  });
}
