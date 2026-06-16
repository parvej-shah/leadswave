import { db } from "@/lib/db";
import { OutreachState } from "../graph";
import { loadWebsiteSummary } from "../lib/context";

export async function loadContextNode(state: OutreachState): Promise<Partial<OutreachState>> {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: state.leadId },
    include: { campaign: true },
  });

  const websiteSummary = await loadWebsiteSummary({
    website: lead.website,
    description: lead.description,
    firecrawlApiKey: state.firecrawlApiKey,
  });

  return { lead, campaign: lead.campaign, websiteSummary };
}
