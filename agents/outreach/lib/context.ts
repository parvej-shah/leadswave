import FirecrawlApp from "@mendable/firecrawl-js";

/** Max chars of scraped website markdown we feed the model as recipient context. */
const MAX_SUMMARY_CHARS = 3000;

/**
 * Build the recipient context the drafting prompts use: live-scraped website
 * markdown when a site + Firecrawl key are available, otherwise the stored
 * lead description. Shared by the email personalize node and the WhatsApp
 * message route so both channels see identical context (and don't drift).
 */
export async function loadWebsiteSummary({
  website,
  description,
  firecrawlApiKey,
}: {
  website?: string | null;
  description?: string | null;
  firecrawlApiKey?: string | null;
}): Promise<string> {
  let summary = description ?? "";

  if (website && firecrawlApiKey) {
    try {
      const app = new FirecrawlApp({ apiKey: firecrawlApiKey });
      const scraped = await app.scrape(website, { formats: ["markdown"] });
      const md = (scraped as { markdown?: string }).markdown ?? "";
      if (md) summary = md.slice(0, MAX_SUMMARY_CHARS);
    } catch {
      // fall back to stored description
    }
  }

  return summary;
}
