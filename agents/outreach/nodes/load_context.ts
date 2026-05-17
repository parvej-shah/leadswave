import FirecrawlApp from "@mendable/firecrawl-js";
import { db } from "@/lib/db";
import { OutreachState } from "../graph";

export async function loadContextNode(state: OutreachState): Promise<Partial<OutreachState>> {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: state.leadId },
    include: { campaign: true },
  });

  let websiteSummary = lead.description ?? "";

  if (lead.website && state.firecrawlApiKey) {
    try {
      const app = new FirecrawlApp({ apiKey: state.firecrawlApiKey });
      const scraped = await app.scrape(lead.website, { formats: ["markdown"] });
      const md = (scraped as { markdown?: string }).markdown ?? "";
      websiteSummary = md.slice(0, 3000);
    } catch {
      // fall back to stored description
    }
  }

  return { lead, campaign: lead.campaign, websiteSummary };
}
