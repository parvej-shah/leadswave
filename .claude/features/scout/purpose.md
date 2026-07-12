# Scout — purpose

**Job:** turn a search query + location into real, deduped, enriched leads in the DB.

**Code:** `agents/scout/` (LangGraph). Two graphs:
- `graph.ts` — web/Firecrawl search → scrape → extract path.
- `maps-graph.ts` — Google Maps/Places path (`maps_search → maps_filter → maps_dedupe →
  maps_enrich → maps_score → maps_save`).

**Triggered by:** user launches a campaign → `app/api/agents/scout/route.ts`.

**Inputs:** `{ campaignId, query, location }` (+ city & hotspot-area selection on the Maps
path — `Campaign.selectedAreas` Json maps city → areas; cities without areas fall back to
the quadrant grid search).

**Output:** new `Lead` rows at `state = "discovered"`, deduped against existing leads;
Telegram "found N leads" ping.

**Supporting libs:** `lib/scraper/client.ts` (Firecrawl), `lib/places/client.ts` (Google
Maps), `lib/email/enrich.ts` + `lib/email/verify.ts` (contact enrichment), `lib/db.ts`.

**Business logic worth knowing:**
- Enrichment finds + verifies emails: Hunter primary, Apify fallback (provider set by
  `Settings.enrichmentProvider`). A lead without a deliverable email shouldn't advance.
- Scoring gates quality before a lead becomes outreach-eligible.
- Dedupe is by domain/company so the same business isn't contacted twice across runs.
