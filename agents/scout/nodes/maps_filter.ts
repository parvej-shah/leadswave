import { MapsScoutState } from "../maps-graph";

// Drop leads that are clearly dead/fake listings. Step 2 (re-enrich) will find emails
// even for leads that have no website or phone yet, so we keep them all here.
function isQualityLead(lead: MapsScoutState["leads"][number]): boolean {
  // Must have a real name (not just a place ID)
  if (!lead.companyName || lead.companyName.trim().length < 2) return false;

  // Drop very-low-rated listings (likely closed / fake)
  // Only apply if a rating exists — no rating means not enough reviews, which is fine
  if (lead.rating !== null && lead.rating < 2.0) return false;

  return true;
}

export async function mapsFilterNode(state: MapsScoutState): Promise<Partial<MapsScoutState>> {
  const before = state.leads.length;
  const leads = state.leads.filter(isQualityLead);
  console.info(`[maps-filter] dropped ${before - leads.length} low-quality leads, ${leads.length} remain`);
  return { leads };
}
