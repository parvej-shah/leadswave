import { MapsScoutState, MapsLead } from "../maps-graph";

// Score signals and weights (total = 100)
// website           → 25  (most valuable — can send personalised email)
// email             → 25  (directly reachable)
// phone             → 15  (alternative contact)
// rating ≥ 4        → 15  (established, reputable business)
// rating 3–3.9      →  8  (partial credit)
// address           → 10  (confirmed physical presence)
// description/desc  →  5  (enriched — we know what they do)
// mapsUrl           →  5  (verifiable listing)

function scoreLead(lead: MapsLead): number {
  let score = 0;

  if (lead.website) score += 25;
  if (lead.email) score += 25;
  if (lead.phone) score += 15;

  if (lead.rating !== null) {
    if (lead.rating >= 4.0) score += 15;
    else if (lead.rating >= 3.0) score += 8;
  }

  if (lead.address) score += 10;
  if (lead.description) score += 5;
  if (lead.mapsUrl) score += 5;

  return Math.min(score, 100);
}

export async function mapsScoreNode(state: MapsScoutState): Promise<Partial<MapsScoutState>> {
  const leads = state.leads.map((l) => ({ ...l, score: scoreLead(l) }));
  // Sort best leads first so review screen shows top prospects at the top
  leads.sort((a, b) => b.score - a.score);
  return { leads };
}
