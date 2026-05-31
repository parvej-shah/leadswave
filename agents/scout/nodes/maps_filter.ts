import { MapsScoutState } from "../maps-graph";

// Drop leads that are clearly dead listings or too low quality to be worth outreaching.
// A lead must pass ALL of these checks to survive.
function isQualityLead(lead: MapsScoutState["leads"][number]): boolean {
  // Must have at least one contact method
  const hasContact = !!(lead.website || lead.phone);
  if (!hasContact) return false;

  // Must have a real name (not just a place ID)
  if (!lead.companyName || lead.companyName.length < 2) return false;

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
