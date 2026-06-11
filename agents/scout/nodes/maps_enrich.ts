import FirecrawlApp from "@mendable/firecrawl-js";
import { MapsScoutState, MapsLead } from "../maps-graph";
import { extractFromUrl, findContactByWebSearch } from "../lib/extract";

const BATCH = 5;

export async function mapsEnrichNode(state: MapsScoutState): Promise<Partial<MapsScoutState>> {
  if (!state.firecrawlApiKey) return { leads: state.leads };

  const firecrawl = new FirecrawlApp({ apiKey: state.firecrawlApiKey });
  const byPlaceId = new Map<string, MapsLead>(state.leads.map((l) => [l.placeId, l]));

  // Has-website (crm) leads: scrape their site for email + description.
  const withSite = state.leads.filter((l) => l.category === "crm" && l.website);
  for (let i = 0; i < withSite.length; i += BATCH) {
    const batch = withSite.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((l) => extractFromUrl(firecrawl, l.website as string, ""))
    );
    results.forEach((result, idx) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const lead = batch[idx];
      const extracted = result.value;
      byPlaceId.set(lead.placeId, {
        ...lead,
        email: extracted.email ?? lead.email,
        emailSource: extracted.email ? "scraped" : lead.emailSource,
        hasContactForm: extracted.hasContactForm ?? lead.hasContactForm,
        facebookUrl: extracted.facebookUrl ?? lead.facebookUrl,
        description: extracted.description || lead.description,
      });
    });
  }

  // CRM leads that still have no email after crawl: fall back to web search.
  const crmNoEmail = withSite.filter((l) => !byPlaceId.get(l.placeId)?.email);
  for (let i = 0; i < crmNoEmail.length; i += BATCH) {
    const batch = crmNoEmail.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((l) => findContactByWebSearch(firecrawl, l.companyName, l.address ?? state.country, l.website ?? undefined))
    );
    results.forEach((result, idx) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const lead = batch[idx];
      const current = byPlaceId.get(lead.placeId)!;
      const found = result.value;
      byPlaceId.set(lead.placeId, {
        ...current,
        email: current.email ?? found.email,
        emailSource: current.email ? current.emailSource : "web_search",
        description: current.description || found.description,
      });
    });
  }

  // No-website (website_proposal) leads: web-search for an email so we can email them.
  const noSite = state.leads.filter((l) => l.category === "website_proposal");
  for (let i = 0; i < noSite.length; i += BATCH) {
    const batch = noSite.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((l) => findContactByWebSearch(firecrawl, l.companyName, l.address ?? state.country))
    );
    results.forEach((result, idx) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const lead = batch[idx];
      const found = result.value;
      byPlaceId.set(lead.placeId, {
        ...lead,
        email: lead.email ?? found.email,
        emailSource: lead.email ? lead.emailSource : "web_search",
        description: lead.description || found.description,
      });
    });
  }

  return { leads: Array.from(byPlaceId.values()) };
}
