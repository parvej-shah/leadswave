# LeadsWave Design System

LeadsWave is an **outbound sales automation tool** for solo founders and small B2B teams. AI agents scout target companies, send personalized cold emails, classify replies as HOT or WARM, draft responses, and book meetings on the user's Google Calendar.

The product is a **daily-driver tool for sales operators** running outbound — they want density, keyboard speed, and information clarity. Think Linear × Vercel Dashboard × Bloomberg Terminal, not consumer SaaS.

## Sources

- **GitHub:** [parvej-shah/leadswave](https://github.com/parvej-shah/leadswave) — Next.js app with Tailwind/shadcn, all screens authored as inline-styled OKLCH. Explore this repo further to extract real component implementations and copy.

## Audience & posture

Sales operators, founders running their own outbound. Power users who live in this tool daily to triage replies, monitor campaign health, and approve AI drafts. **Density and speed over hand-holding.**

Comparable products they love: Linear, Vercel Dashboard, Attio, Cron/Notion Calendar, Bloomberg Terminal.

## Index

```
README.md                  ← you are here
colors_and_type.css        formal token sheet (OKLCH + type scale)
SKILL.md                   skill manifest for Claude Code / agents
fonts/                     DM Mono + Inter (sans) + Georgia (serif) refs
assets/                    logo, icon notes
preview/                   design-system cards (typography, colors, components)
ui_kits/leadswave-app/     UI kit — 8 screens, full component set
  index.html               clickable prototype across all screens
  signature.html           4-frame signature interaction (HOT → reply → send)
  components/              Button, Badge, Card, Table, Input, Nav, KPI, etc.
  screens/                 Login, Dashboard, Campaigns, Leads, Inbox, Settings…
```

## Content Fundamentals

**Tone.** Operator-to-operator. The user is a working salesperson, not a beginner. Copy is short, declarative, lower-pressure. Never marketing-speak. No exclamation points outside error states. No "Welcome!" — instead, **"Welcome back."** No "Awesome! 🎉" — instead, **"4 leads discovered"**.

**Casing.**
- **Sentence case** for headings, subheads, body, dialog titles: *"New Campaign"*, *"Confirm Deletion"*, *"No campaigns yet."*
- **UPPERCASE with wide tracking (0.06–0.20em)** for mono micro-labels: column headers, field labels, badges, eyebrows — *"LEADSWAVE"*, *"HOT"*, *"COMPANY NAME"*, *"YOU →"*.
- **lowercase** for in-progress states: *"creating campaign…"*, *"scouting leads… (this takes ~30s)"*. The lowercase + ellipsis says "this is a machine doing work, not a designed moment."
- **CamelCase / Mono identifiers** for state machine values: `discovered`, `contacted`, `replied`, `converted`, `unsubscribed`, `bounced`.

**Pronouns.** *You* (the operator) and *they* (the lead). Never *we*. The product never refers to itself in the first person — it's a tool, not a teammate. Direction tags in threads: `YOU →` / `← THEM` / `AI DRAFT`.

**Counts & numbers.** Always shown raw, never spelled out. `0`, `4`, `127`. Use `—` as the empty placeholder, never `N/A` or `0` for "not applicable". Percentages with one decimal: `12.4%`. Relative timestamps over absolute: `12m ago`, `3h ago`, `2d ago`.

**Empty states.** Dashed-border card, mono muted copy, single amber link CTA.
> No campaigns yet.
> Launch your first campaign →

**Errors.** Red-orange text in a tinted box. Plain and direct. *"Send failed"*, *"Failed to load campaigns."* Never "Oops!" or "Something went wrong."

**Status verbs.** Present-progressive lowercase for system states: *"Scouting…"*, *"AI Writing…"*, *"Sending…"*. These read as terminal output.

**No emoji as decoration.** Emoji are used **only as semantic state markers** in the activity feed (🔥 hot reply, 📅 meeting booked, ✉️ contacted) and even that is on a short leash — see Iconography below.

## Visual Foundations

### Canvas & surfaces

A 4-step grayscale forms the entire chrome of the product. No gradients on chrome. No drop shadows anywhere. No soft pastel surfaces.

| Token | OKLCH | Role |
|---|---|---|
| `--canvas` | `oklch(0.09 0 0)` | App background (the deepest surface) |
| `--sidebar` | `oklch(0.10 0 0)` | Fixed left rail, modal scrim base |
| `--surface` | `oklch(0.14 0 0)` | Cards, table rows, KPI tiles |
| `--surface-2` | `oklch(0.16 0 0)` | Hovered rows, secondary tinted blocks |

Cards are `border-radius: 0.75rem` (rounded-xl) with a single `1px solid oklch(1 0 0 / 7%)` border. Inside-card section dividers and table row separators use `oklch(1 0 0 / 4%)` — barely visible, exactly enough to imply structure.

### Color — semantic only

The accent palette is **load-bearing**: every accent color must justify itself with a state. No decorative color.

- **Amber `oklch(0.78 0.18 65)`** — the brand. Primary CTA, active nav, AI-draft accent bar, focus rings, links. Tinted `15%` background + matching text + `30%` border for badges/buttons.
- **Red-orange `oklch(0.70 0.20 25)`** — HOT leads, destructive actions, errors.
- **Green `oklch(0.72 0.18 145)`** — positive states: `replied`, `converted`, success, inbound message bubble.
- **Blue `oklch(0.65 0.18 260)`** — meetings booked, AI-draft direction tag.

Text is a 5-step neutral scale on the dark canvas: `0.92`, `0.80`, `0.65`, `0.45`, `0.32`. The 0.45 step does most of the work for secondary copy.

### Typography

Three families, with very deliberate roles.

- **DM Mono** is the **dominant voice** — nav, labels, table headers, badges, buttons, KPI labels, timestamps, status pills, identifiers. The monospace IS the brand.
- **Inter** (sans) for body copy and short headings inside the app.
- **Georgia** serif is **reserved for exactly one editorial moment**: the welcome heading on the login/auth screen. It signals "this is the front door" without becoming a marketing-site flourish. Do not use it inside the working app.

Tracking is a tool, not decoration:
- **Tight `-0.02em`** on display sans (h1, h2)
- **Wide `0.06–0.20em` + UPPERCASE** on mono micro-labels — the wider the tracking, the smaller the label

Tiny text (10–11px mono) is normal here. Densities on `<body>` are `13px`. KPI values are `24px semibold`. There is no `text-xl` in marketing-site sense.

### Spacing & sizing

- 4-point base. Common rhythm: `6 / 8 / 12 / 16 / 20 / 24 / 32 / 48`.
- Page padding `24px` (`p-6`). Card padding `16–20px`. Row padding `10–12px vertical`.
- Sidebar is **224px fixed** (Tailwind `w-56`). Collapses to a 56px icon rail.
- Tables are dense — 11px headers, 13px row text, 10–12px vertical padding.

### Borders, radius, no-shadow

- Card radius `0.75rem` (xl). Button radius `0.375–0.5rem` (sm–md). Pill radius `9999px` reserved for status badges in some places.
- Borders are always `1px`. Translucent-white at low alpha (`7%`, `4%`) on dark; tinted color at `30%` for badge outlines.
- **No drop shadows.** Anywhere. Elevation is communicated by surface step, not light.

### Backgrounds & motifs

The login/auth screen has **two background motifs** that do not appear inside the working app:

1. A **40px grid overlay** at `3.5%` opacity (white lines, both directions).
2. A **600×600 amber blur-orb**, centered, `6%` opacity, `120px` blur radius.

Use the same motif sparingly for empty states of "first run" moments (e.g. blank dashboard before any campaigns exist).

### Animation

Minimal and functional. Three primitives only:

- **`transition: color/background 150ms ease`** on hover for buttons and nav.
- **Pulse** on a 2×2px amber dot — *only* for "fresh signal" indicators (hot-lead arrival on Inbox nav, status dots on dialog headers, the amber dot above the LeadsWave eyebrow on login).
- **Fade-in `200ms`** when content loads (lead list rows, filter panel).

No bouncy springs. No staggered entrance reveals. No micro-interactions for their own sake. The terminal does not wink at you.

### Hover & press states

- **Hover on nav rail item:** background goes from `transparent` → `oklch(0.14 0 0)`.
- **Hover on table row:** `oklch(0.115 0 0)` → `oklch(0.13 0 0)`. Alternating-row backgrounds are kept (zebra at `0.115` / `0.105`).
- **Hover on primary amber button:** `oklch(0.78 0.18 65)` → `oklch(0.84 0.16 65)` (lighter, slightly desaturated).
- **Hover on tinted-badge button:** `opacity` from `0.85` → `1`.
- **Disabled buttons:** `opacity: 0.4`, `cursor: not-allowed`. No color change.
- **Press:** no explicit press state. The hover state holds until release.

### Transparency, blur

Used sparingly. The only blur in the system is the **120px amber orb** on the auth screen. Modal scrim is `bg-black/75 backdrop-blur-sm`. Filter/search panel has a subtle `backdrop-blur-sm` over a `0.95` alpha surface. **No glassmorphism on regular chrome.**

### Imagery

This product has effectively **no decorative imagery**. There are no hero photos, no illustrations, no avatar placeholders. The only "images" are:

- The **LeadsWave wordmark** in DM Mono semibold.
- The **Google logo** SVG (signin button).
- **Lucide icons** (search, filter, X, plus, arrow) at 14–16px.
- Optional **company favicons** in lead tables — fetched dynamically, fall back to a colored initial square if absent.

If imagery enters the product (e.g. company OG images on a lead detail page) it should be cool-toned, monochromatic, and grain-free. No warm portraits, no stock photography vibes.

## Iconography

LeadsWave uses **[Lucide](https://lucide.dev)** (`lucide-react` in the codebase) at `14px–16px`, default stroke weight `1.5`, current color. The codebase imports a small set: `Search`, `Filter`, `X`, plus arrow glyphs (`→`) typed as unicode in mono text.

- Icon color matches surrounding text color (`currentColor`).
- Icons sit inline with mono labels — never large, never decorative.
- The Google G logo (SVG) is included verbatim from the codebase for the auth screen.
- **Unicode arrows** (`→`, `←`) are used as in-line glyphs in CTAs and direction tags (`YOU →`, `← THEM`) because they kern naturally with DM Mono.
- **Emoji** appear in exactly one place — the dashboard Recent Activity feed (🔥 / 📅 / ✉️) — as semantic state markers, sized to match the body text. Anywhere else, replace with a Lucide icon or a colored dot.

If you need an icon LeadsWave doesn't already use, **pull it from Lucide first.** If Lucide doesn't have it, ship the design without the icon rather than introducing a second icon family.

> **CDN substitution flag:** This design system links Lucide via CDN (`unpkg.com/lucide@latest`) and Google Fonts for DM Mono / Inter / Georgia. The codebase uses `next/font` with Geist; we've swapped to **DM Mono** (the explicit spec) and **Inter** in place of Geist Sans. If you have the production Geist files, drop them into `fonts/` and adjust `colors_and_type.css`.

## How to use this design system

1. Open `preview/` cards in the Design System tab to see tokens at a glance.
2. Open `ui_kits/leadswave-app/index.html` for a clickable prototype across all 8 screens.
3. Open `ui_kits/leadswave-app/signature.html` for the 4-frame HOT-lead-to-sent-reply storyboard.
4. Import `colors_and_type.css` into a new mock to pick up tokens immediately. Variable names map 1:1 onto the existing globals.css names where they exist.
5. Read `SKILL.md` if you're using this with Claude Code.

## What's in the v2 UI kit (May 2026 refresh)

The UI kit was modernized in a focused UX pass. Highlights:

- **Dashboard "Needs your attention" section** — 3-tile triage row above the KPI strip surfacing HOT replies, today's meetings, and review-required scouts. Each tile has a semantic dot/badge and a single amber link CTA.
- **KPI tiles with SVG smooth area sparklines** — replaced bar-chart sparklines with proper Bézier-curved area charts (last-point dot) at 200×28. Delta is now a pill with a directional triangle next to the value, not a footer line.
- **24H / 7D / 30D / YTD segmented period switcher** on the dashboard header — same segmented primitive used to filter the Inbox by HOT/WARM and toggle Leads density.
- **Sidebar workspace header** — `L` mark + workspace name + tier eyebrow, with a dropdown for workspace switching. A search trigger directly under it surfaces the ⌘K palette. The footer carries the user profile with avatar.
- **Campaigns rail in the sidebar** — bottom-of-nav list of active campaigns with status dot and inline hot-count badge, so users can jump straight to a campaign without first hitting the Campaigns index.
- **Real command palette (⌘K)** — fuzzy text filter, arrow-key navigation, grouped commands (Navigate / Create / Run / Leads / Account), per-row keyboard shortcuts, and a footer hint bar. Press `Esc` to close, `↵` to execute.
- **Inbox v2** — time-grouped thread list (Today / Yesterday / This Week), `All / Hot / Warm` filter, avatars on rows, fresh-thread amber dot. Detail header has avatar + status + action buttons (Not interested / Book meeting). Message bubbles redesigned with a colored left edge instead of a heavy border.
- **Inbox lead context panel** — collapsible 280px right rail with the lead's Company / Email / Campaign / State, AI-detected signals ("Replied within 48h", "Asked about pricing"), a vertical timeline of touchpoints, and next-step suggestions. Auto-collapses on narrow viewports.
- **Refined composer** — the AI-draft state is signalled by an amber left edge on the textarea + an "AI DRAFT · edit before sending" mono header + tone/token info on the right. Below the text area sits a thin toolbar (insert calendar link, insert signature, char count).
- **Leads v2** — sortable column headers with directional caret, cozy/dense row density toggle, mini engagement bars on each row, single-letter avatar on every company, hover-revealed inline actions. Keyboard: `j/k` to navigate, `/` to focus search, `x` to toggle selection, `↵` to open.
- **Campaigns v2** — cards with status dot (pulsing for active), name + query subline, three compact metric blocks (LEADS with sparkline · REPLY % with progress bar · SIGNAL with HOT/MTG pills), and hover-revealed actions.
- **Button polish** — primary button has an inset top-highlight, secondary picks up a subtle inset edge, all variants have proper hover transitions including tinted variants getting slightly more saturated backgrounds.
- **New primitives** — `Segmented`, `DeltaPill`, `Avatar`, plus richer `Sparkline` (SVG with gradient area + last-point dot).
