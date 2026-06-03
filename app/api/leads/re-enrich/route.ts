import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import FirecrawlApp from "@mendable/firecrawl-js";
import { extractFromUrl, findContactByWebSearch } from "@/agents/scout/lib/extract";

const BATCH = 5;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSystemSettings();
  if (!settings?.firecrawlApiKey) {
    return NextResponse.json({ error: "Firecrawl API key not configured in settings" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const campaignId: string | undefined = body.campaignId;

  const where = {
    deletedAt: null,
    email: null,
    ...(campaignId ? { campaignId } : {}),
  };

  const leads = await db.lead.findMany({
    where,
    select: { id: true, companyName: true, website: true, address: true },
  });

  if (leads.length === 0) return NextResponse.json({ updated: 0, total: 0 });

  const firecrawl = new FirecrawlApp({ apiKey: settings.firecrawlApiKey });
  let updated = 0;

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (lead) => {
        // Try scraping the website first if available
        if (lead.website) {
          const extracted = await extractFromUrl(firecrawl, lead.website, "");
          if (extracted?.email) return { id: lead.id, email: extracted.email };
        }
        // Fall back to web search
        const found = await findContactByWebSearch(
          firecrawl,
          lead.companyName,
          lead.address ?? "",
          lead.website ?? undefined,
        );
        if (found?.email) return { id: lead.id, email: found.email };
        return null;
      }),
    );

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      await db.lead.update({
        where: { id: result.value.id },
        data: { email: result.value.email },
      });
      updated++;
    }
  }

  return NextResponse.json({ updated, total: leads.length });
}
