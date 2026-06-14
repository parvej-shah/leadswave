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
import { enrichEmail, QuotaExceededError, type EnrichmentProvider, type EnrichedEmail } from "@/lib/email/enrich";

// Free/low-tier Firecrawl plans cap ~6 req/min; each lead can fire several
// map/scrape/search calls, so keep batches small and pace between them.
const BATCH = 2;
const BATCH_DELAY_MS = 8000;
// Paid Hunter.io lookups per run — keeps a large backfill from surprise-billing.
// Tunable via env; intentionally low because each call costs a Hunter credit.
const ENRICHMENT_CAP_PER_RUN = Number(process.env.ENRICHMENT_CAP_PER_RUN ?? 25);

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
      enrichmentTriedAt: true,
    },
  });

  if (leads.length === 0) return NextResponse.json({ updated: 0, emailsFound: 0, total: 0 });

  // Short timeout + no retries: on a rate-limited plan, a default 5min-timeout
  // x3-retries per call can stall a single lead for 15+ minutes.
  const firecrawl = new FirecrawlApp({ apiKey: settings.firecrawlApiKey, timeoutMs: 20000, maxRetries: 0 });
  let emailsFound = 0;
  let updated = 0;
  let enrichmentCalls = 0; // Hunter credits spent this run (capped)
  let channelsFound = 0; // contact forms + facebook pages discovered
  // Once Hunter reports its monthly quota is spent, flip to Apify (if a key is
  // set) for the rest of the run instead of hammering a dead provider.
  let hunterQuotaSpent = false;
  let apifyFallbackUsed = 0;

  // Per-run, per-domain cache so two leads sharing a domain only ever cost one
  // enrichment credit. Maps lowercased domain -> the enrichment result (or null).
  const enrichmentCache = new Map<string, EnrichedEmail | null>();

  for (let i = 0; i < leads.length; i += BATCH) {
    if (i > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
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

        // Layer 3: paid enrichment as the final email fallback. Primary is the
        // configured provider (Hunter by default); once Hunter reports its
        // monthly quota is spent, the run falls through to Apify (if a key is
        // set) for this and every later lead.
        // Cost-control gates, in order:
        //   • only if no email found by free layers above (scrape/search/guess)
        //   • only if an enrichment key is configured
        //   • skip leads with no domain — providers need a domain/URL, so a
        //     domainless lead is a guaranteed-empty (but still billed) call
        //   • skip leads already attempted in a prior run (enrichmentTriedAt)
        //   • reuse a per-run cache so duplicate domains cost one credit total
        //   • stop once the per-run credit cap is hit
        let enrichTried = false;
        const domain = lead.website ? domainFromUrl(lead.website) : null;
        if (
          !email &&
          settings.enrichmentApiKey &&
          domain &&
          !lead.enrichmentTriedAt &&
          enrichmentCalls < ENRICHMENT_CAP_PER_RUN
        ) {
          const cacheKey = domain.toLowerCase();
          let enriched: EnrichedEmail | null = null;
          if (enrichmentCache.has(cacheKey)) {
            enriched = enrichmentCache.get(cacheKey) ?? null;
          } else {
            const configured = (settings.enrichmentProvider as EnrichmentProvider) || "hunter";
            // If Hunter already ran out earlier this run, go straight to Apify.
            const useApify = hunterQuotaSpent && settings.apifyApiKey;
            try {
              if (useApify) {
                apifyFallbackUsed++;
                enriched = await enrichEmail({
                  provider: "apify",
                  apiKey: settings.apifyApiKey,
                  companyName: lead.companyName,
                  domain,
                  websiteUrl: lead.website,
                });
              } else {
                enrichmentCalls++; // a real (billed) primary-provider call
                enriched = await enrichEmail({
                  provider: configured,
                  apiKey: settings.enrichmentApiKey,
                  companyName: lead.companyName,
                  domain,
                  websiteUrl: lead.website,
                });
              }
            } catch (err) {
              // Primary provider out of quota — switch to Apify for the rest of
              // the run and retry THIS lead on Apify right now.
              if (err instanceof QuotaExceededError && err.provider !== "apify") {
                hunterQuotaSpent = true;
                if (settings.apifyApiKey) {
                  apifyFallbackUsed++;
                  enriched = await enrichEmail({
                    provider: "apify",
                    apiKey: settings.apifyApiKey,
                    companyName: lead.companyName,
                    domain,
                    websiteUrl: lead.website,
                  }).catch(() => null);
                }
              }
            }
            enrichmentCache.set(cacheKey, enriched);
          }
          enrichTried = true; // mark so we never re-bill this lead on re-runs
          if (enriched) {
            email = enriched.email;
            emailSource = "enriched";
            emailStatus = enriched.status;
          }
        }

        if (!email && !enrichTried && !description && hasContactForm === null && !facebookUrl) return null;

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

        return { id: lead.id, email, emailSource, emailStatus, description, hasContactForm, facebookUrl, score: newScore, enrichTried };
      }),
    );

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { id, email, emailSource, emailStatus, description, hasContactForm, facebookUrl, score, enrichTried } = result.value;
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
          // Stamp the Hunter attempt so a re-run skips this lead (no re-billing)
          ...(enrichTried ? { enrichmentTriedAt: new Date() } : {}),
          score,
        },
      });
      updated++;
      if (email) emailsFound++;
      if (hasContactForm || facebookUrl) channelsFound++;
    }
  }

  return NextResponse.json({
    updated,
    emailsFound,
    channelsFound,
    enrichmentCalls,
    apifyFallbackUsed,
    total: leads.length,
  });
}
