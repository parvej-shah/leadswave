# TODO

Deferred work from the design-system migration. Each item is intentional —
listed here so it isn't forgotten, but not currently blocking.

## Dashboard

- [ ] **KPI sparklines (7-day trend per metric)**
      Each KPI tile should show a 7-day area sparkline beneath the value.
      Needs a backend query that buckets `Message` rows by day for the last 7
      days (one query per metric, or one grouped query). The `KPI` primitive in
      `components/ui/kpi.tsx` already accepts `spark: number[]` and
      `sparkColor` — just pass the buckets in from
      `app/(dashboard)/page.tsx`.

- [ ] **"Needs your attention" triage row**
      3-tile row above the KPI strip surfacing: HOT replies waiting, today's
      meetings, scouts pending review. Needs a product decision on what
      qualifies as "needs review" (probably: leads in `discovered` state from
      the last scout run that haven't been contacted yet). See the DS
      reference at
      `LeadsWave Design System/ui_kits/leadswave-app/screens/Dashboard.jsx`
      → `NeedsAttention`.

- [ ] **Period switcher (24H / 7D / 30D / YTD)**
      Segmented control next to the dashboard header that re-scopes KPIs and
      Campaign Health to a time window. Needs:
  1. Time-series backend (same query as sparklines, just parameterized).
  2. URL-driven state (`?period=7d`) so server-rendered KPIs respect it.
     Use the `Segmented` primitive — it's already shipped.

## Campaigns

- [ ] **Import CSV page DS pass**
      `app/(dashboard)/campaigns/[id]/import/page.tsx` (~405 lines) hasn't been
      migrated to the design system yet. No DS reference screen exists for it,
      so it's a separate design pass — needs upload UI, column-mapping, and
      preview states defined before code changes.

- [ ] **Right-pane "scouted leads preview" on New Campaign**
      The DS reference shows a live right-pane preview of scouted leads as they
      stream in. Currently scout runs async via `/api/agents/scout` and we show
      the resulting count on the done card — which matches the real backend
      behavior. To ship the live preview we'd need either: (a) streaming
      results from the scout endpoint (SSE / chunked), or (b) a polling loop
      against a partial-results endpoint. Decide which before building.

## Inbox

- [ ] **Lead context side panel**
      Right-side 280px panel showing Lead facts, Signals (replied <48h, asked
      pricing, mentioned timeline, no unsub intent), Timeline (initial
      outreach → reply → awaiting), and Next-step actions (suggest meeting,
      move to Won). Needs a signals backend — none of those facts are
      currently derivable from `Message`/`Lead` without an NLP pass over
      inbound bodies. See `LeadsWave Design System/ui_kits/leadswave-app/screens/Inbox.jsx`
      → `LeadContextPanel`.

- [ ] **Inbox keyboard shortcuts (J/K/R/E)**
      DS reference wires `j`/`k` to navigate threads, `r` to focus composer,
      `e` to archive. Add `<Kbd>` hints in the list footer and a `keydown`
      handler scoped to the Inbox route. The global ⌘K palette is already
      shipped — these are page-local shortcuts on top of it.

- [ ] **Composer "Insert calendar link" / Signature buttons**
      Toolbar below the textarea in the DS reference. Needs: (a) decision on
      where calendar links come from (Calendly URL stored in Settings?
      generated per-rep?), and (b) signature stored on User. Currently the
      composer just has a char counter.

## Settings

- [ ] **Email Signature tab**
      DS reference has a dedicated Signature tab (textarea appended to every
      outbound email). Not in current schema — needs a `signature` field on
      `Settings` (or `User`) and the outreach agent to actually append it
      before sending. Tied to the Inbox composer Signature button above.

- [ ] **Per-campaign / throttle sending limits**
      DS reference exposes three knobs: Daily Cap, Per-Campaign-Per-Day,
      Throttle (seconds between sends). Today only Daily Cap is wired up
      end-to-end. Needs schema fields + sender-loop enforcement before
      surfacing the inputs.

- [ ] **Connection tab (Google account card)**
      DS reference shows the connected Google identity with Reconnect /
      Disconnect actions and a scopes line ("Calendar · Gmail · Read &
      Send"). Today we just show a check on the Calendar tab when a refresh
      token is present. Needs: profile fetch endpoint + a real "disconnect"
      that clears the stored refresh token.

- [ ] **Team tab**
      DS reference lists teammates with roles + invite flow. There is no
      multi-user / org model in the schema yet — this is a meaningful
      product expansion, not a UI pass. Park until multi-user is on the
      roadmap.

- [ ] **Notifications: Email digest + HOT-only filter toggles**
      DS reference offers Telegram + Email-digest + HOT-only toggles. Today
      only Telegram chat ID is wired (and only as a read-only auto-detected
      value). Needs: (a) a daily digest job, (b) a notification-preferences
      field on Settings, (c) wiring HOT-only into the Telegram alert path.

## Command Palette (⌘K)

- [ ] **Lead search inside the palette**
      Currently the palette lists navigation, the 5 most recent campaigns,
      and a couple of actions. To search across all leads (by company /
      email) we need either: (a) a `/api/search` endpoint that the palette
      hits on debounced query, or (b) preloading lead names into the
      layout payload (only viable for small accounts). Pick after we see
      how big real accounts get.

- [ ] **Recent commands / fuzzy ranking**
      Today the palette filter is a plain substring `includes`. Real
      palettes rank by recency + fuzzy match (e.g. fzf-style subsequence
      scoring). Add a `localStorage`-backed recents list and a small
      scorer when the command set grows past ~20 items.

- [ ] **`G D` / `G C` / `G L` / `G I` / `G S` two-key navigation**
      Sidebar already advertises these key hints in tooltips. Wire a
      global two-key sequence handler (press `g`, then within 800ms press
      destination key) so the hints become real shortcuts. Skip inside
      inputs/textareas. Pair with the Inbox J/K/R/E item above — both want
      the same "skip when typing" guard.
