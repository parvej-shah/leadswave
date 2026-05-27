# TODO

Deferred work from the design-system migration. Each item is intentional —
listed here so it isn't forgotten, but not currently blocking.

## Dashboard

- [x] **KPI sparklines (7-day trend per metric)**
      Shipped: `sparkBuckets()` helper in `app/(dashboard)/page.tsx` builds 7-day
      day-by-day counts for sent, replies, hot leads, meetings, and total leads.
      Passed as `spark[]` + `sparkColor` to each `KPI` tile.

- [x] **"Needs your attention" triage row**
      Shipped: `NeedsAttention` component in `app/(dashboard)/page.tsx`. Shows up to
      3 tiles — HOT replies waiting (→ /inbox), today's calendar meetings, and
      discovered leads pending review (→ /leads). Tiles are hidden when count is 0.

- [x] **Period switcher (24H / 7D / 30D / YTD)**
      Shipped: `DashboardPeriodSwitcher` client component (`dashboard-period-switcher.tsx`)
      uses `useRouter` + `useSearchParams` to push `?period=` to the URL. Server
      component reads `searchParams.period` and re-scopes all KPI counts via
      `periodWindow()`. Sparklines always show 7-day buckets regardless of period.

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

- [x] **Inbox keyboard shortcuts (J/K/R/E)**
      Shipped: `keydown` handler in `InboxPage` (inbox/page.tsx). J/K navigate
      threads, R focuses `#inbox-draft`, E archives the selected lead. Uses
      `useRef` to avoid stale closures. `<Kbd>` hints shown in list footer.
      Skips when focus is in an input/textarea/contenteditable.

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

- [x] **Per-campaign / throttle sending limits**
      Shipped: `perCampaignDailyLimit` and `sendThrottleSeconds` added to
      `Settings` schema (migration `20260525000000`). Both enforced in
      `app/api/cron/process-jobs/route.ts`. UI knobs on the Limits tab in
      `app/(dashboard)/settings/page.tsx`.

- [x] **Connection tab (Google account card)**
      Shipped: new "Connection" tab in Settings. `GET /api/auth/google/profile`
      returns name/email/image from session (only when refresh token is present).
      `DELETE /api/auth/google/disconnect` clears `googleRefreshToken` from Settings.
      Card shows avatar, name, email, scopes line, plus Reconnect and Disconnect
      buttons. Disconnect optimistically updates the UI without a page reload.

- [ ] **Team tab**
      DS reference lists teammates with roles + invite flow. There is no
      multi-user / org model in the schema yet — this is a meaningful
      product expansion, not a UI pass. Park until multi-user is on the
      roadmap.

- [x] **Notifications: Email digest + HOT-only filter toggles**
      Shipped: `notifyHotOnly` and `notifyEmailDigest` added to `Settings` schema
      (migration `20260527000000`). `HOT-only` toggle suppresses warm "has a question"
      Telegram pings while keeping HOT/meeting alerts. Daily digest cron at
      `GET /api/cron/digest` (scheduled 8am UTC in `vercel.json`) sends yesterday's
      pipeline summary via Telegram when digest is enabled. Settings Notifications tab
      has both toggles + "Send digest now" test button.

## Command Palette (⌘K)

- [x] **Lead search inside the palette**
      Shipped: `GET /api/search?q=` endpoint searches leads by `companyName`
      and `email` (case-insensitive, top 8 by `lastTouchedAt`). Palette
      debounces 200ms, shows a "Leads" group above commands when query ≥ 2
      chars. Selecting a lead navigates to `/leads?highlight=<id>`. Spinner
      (animated `refresh` icon) shows while fetching. Keyboard nav unified
      via `flatItems` array (leads first, then commands).

- [x] **Recent commands / fuzzy ranking**
      Shipped: `localStorage`-backed recents (`lw:cmd-recents`, max 5) saved
      on every `runAction`. Empty-query view shows a "Recent" group at top.
      Non-empty query uses a subsequence scorer (consecutive-match bonus) instead
      of plain `includes`, results sorted by score desc. All in `command-palette.tsx`.

- [x] **`G D` / `G C` / `G L` / `G I` / `G S` two-key navigation**
      Shipped: global `keydown` handler in `Sidebar` (sidebar.tsx). Press `g`,
      then within 800ms press `d/c/l/i/s` to navigate. Skips when focus is
      in an input/textarea/contenteditable. Uses a `useRef` pending flag +
      800ms timeout. Pairs with ⌘K palette and Inbox J/K shortcuts.
