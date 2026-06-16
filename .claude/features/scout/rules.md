# Scout — rules

- Never skip dedupe before `save` — duplicate companies across runs are a correctness bug.
- Never advance a lead past `discovered` without a verified email; that's outreach's gate.
- Respect Firecrawl/Maps quotas: keep scrapes bounded (the design target is ~5 parallel,
  ~50 leads/batch). Don't fan out unboundedly.
- Don't rescrape the same domain repeatedly within a short window (cooldown intent).
- Enrichment provider order is Hunter → Apify; honor `Settings.enrichmentProvider` and the
  per-user API keys. Never hardcode keys.
- Both graph paths (web + maps) must keep writing leads in the same shape/state so
  downstream outreach is path-agnostic.
- New nodes go under `agents/scout/nodes/`; keep extraction logic in `agents/scout/lib/`.
