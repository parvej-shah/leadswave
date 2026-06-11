import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSystemSettings } from "@/lib/settings";
import FirecrawlApp from "@mendable/firecrawl-js";
import { extractFromUrl, findContactByWebSearch } from "@/agents/scout/lib/extract";
import { scoreLead } from "@/agents/scout/nodes/maps_score";
import {
  domainFromUrl,
  guessAndVerifyEmail,
  verifyFoundEmail,
  type EmailVerdict,
} from "@/lib/email/verify";
import { enrichEmail, type EnrichmentProvider } from "@/lib/email/enrich";

const BATCH = 5;
// Paid-API lookups per run — keeps a large backfill from surprise-billing.
const ENRICHMENT_CAP_PER_RUN = 50;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSystemSettings();
  if (!settings?.firecrawlApiKey) {
    return NextResponse.json({ error: "Firecrawl API key not configured in settings" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const campaignId: string | undefined = body.campaignId;

  // Target leads missing email (regardless of whether they have a website)
  const where = {
    deletedAt: null,
    email: null,
    ...(campaignId ? { campaignId } : {}),
  };

  const leads = await db.lead.findMany({
    where,
    select: {
      id: true,
      companyName: true,
      website: true,
      address: true,
      phone: true,
      rating: true,
      description: true,
      mapsUrl: true,
    },
  });

  if (leads.length === 0) return NextResponse.json({ updated: 0, emailsFound: 0, total: 0 });

  const firecrawl = new FirecrawlApp({ apiKey: settings.firecrawlApiKey });
  let emailsFound = 0;
  let updated = 0;
  let enrichmentCalls = 0;
  let channelsFound = 0; // contact forms + facebook pages discovered

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (lead) => {
        let email: string | null = null;
        let emailSource: string | null = null;
        let emailStatus: EmailVerdict | null = null;
        let description = lead.description ?? "";
        let hasContactForm: boolean | null = null;
        let facebookUrl: string | null = null;

        // Try scraping the website first — also picks up description and
        // alternative channels (contact form, Facebook page)
        if (lead.website) {
          const extracted = await extractFromUrl(firecrawl, lead.website, "");
          if (extracted) {
            email = extracted.email ?? null;
            if (email) emailSource = "scraped";
            if (extracted.description) description = extracted.description;
            hasContactForm = extracted.hasContactForm ?? null;
            facebookUrl = extracted.facebookUrl ?? null;
          }
        }

        // Fall back to web search if still no email
        if (!email) {
          const found = await findContactByWebSearch(
            firecrawl,
            lead.companyName,
            lead.address ?? "",
            lead.website ?? undefined,
          );
          if (found) {
            email = found.email ?? null;
            if (email) emailSource = "web_search";
            if (found.description && !description) description = found.description;
          }
        }

        // Verify whatever we found; a hard bounce hurts the sending domain
        // more than a missing email does.
        if (email) {
          emailStatus = await verifyFoundEmail(email, settings.emailVerifierApiKey || undefined);
          if (emailStatus === "invalid") {
            email = null;
            emailSource = null;
            emailStatus = null;
          }
        }

        // Still nothing: guess common mailboxes on their domain and verify
        // via SMTP handshake (needs the verifier API — never guess blind).
        if (!email && lead.website && settings.emailVerifierApiKey) {
          const domain = domainFromUrl(lead.website);
          if (domain) {
            const guessed = await guessAndVerifyEmail(domain, settings.emailVerifierApiKey);
            if (guessed) {
              email = guessed.email;
              emailSource = "guessed";
              emailStatus = guessed.status;
            }
          }
        }

        // Layer 3: paid enrichment API as the final email fallback, capped per run
        if (!email && settings.enrichmentApiKey && enrichmentCalls < ENRICHMENT_CAP_PER_RUN) {
          enrichmentCalls++;
          const enriched = await enrichEmail({
            provider: (settings.enrichmentProvider as EnrichmentProvider) || "hunter",
            apiKey: settings.enrichmentApiKey,
            companyName: lead.companyName,
            domain: lead.website ? domainFromUrl(lead.website) : null,
          });
          if (enriched) {
            email = enriched.email;
            emailSource = "enriched";
            emailStatus = enriched.status;
          }
        }

        if (!email && !description && hasContactForm === null && !facebookUrl) return null;

        // Re-score with whatever we now know (email +25 if found)
        const newScore = scoreLead({
          companyName: lead.companyName,
          website: lead.website ?? null,
          email,
          phone: lead.phone ?? null,
          rating: lead.rating ?? null,
          address: lead.address ?? null,
          description: description || null,
          mapsUrl: lead.mapsUrl ?? null,
          // required by MapsLead type but not used by scoreLead
          category: "crm",
          placeId: lead.id,
          score: 0,
        });

        return { id: lead.id, email, emailSource, emailStatus, description, hasContactForm, facebookUrl, score: newScore };
      }),
    );

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { id, email, emailSource, emailStatus, description, hasContactForm, facebookUrl, score } = result.value;
      await db.lead.update({
        where: { id },
        data: {
          ...(email
            ? {
                email,
                emailSource,
                emailStatus,
                emailVerifiedAt: emailStatus === "verified" || emailStatus === "catch_all" ? new Date() : null,
              }
            : {}),
          ...(description ? { description } : {}),
          ...(hasContactForm !== null ? { hasContactForm } : {}),
          ...(facebookUrl ? { facebookUrl } : {}),
          score,
        },
      });
      updated++;
      if (email) emailsFound++;
      if (hasContactForm || facebookUrl) channelsFound++;
    }
  }

  return NextResponse.json({ updated, emailsFound, channelsFound, total: leads.length });
}
