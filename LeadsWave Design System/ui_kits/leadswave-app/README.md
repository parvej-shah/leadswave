# LeadsWave UI Kit

Pixel-faithful recreation of the LeadsWave web app, modular React components, dark-only.

## Files

- `index.html` — entry. Clickable prototype across all 8 screens.
- `signature.html` — 4-frame signature interaction (HOT lead → open thread → edit AI draft → send).
- `data.js` — mock leads, campaigns, messages, settings.
- `components.jsx` — primitives: `Button`, `Badge`, `StateBadge`, `Card`, `Input`, `Select`, `Textarea`, `KPI`, `EmptyState`, `Dialog`, `Toast`, `DirectionTag`, `Sparkline`.
- `Sidebar.jsx` — 224px fixed nav rail with collapsible-to-rail mode and signal-pulse on Inbox.
- `screens/` — one file per screen: `Login`, `Dashboard`, `Campaigns`, `CampaignNew`, `Leads`, `Inbox`, `Settings`.
- `app.jsx` — App shell + screen router + URL hash routing.

## Components covered

| Component | States |
|---|---|
| `Button` | primary, secondary, ghost, destructive, tinted, sizes sm/md, disabled |
| `Badge` | hot, warm, success, info, neutral |
| `StateBadge` | discovered, contacted, replied, converted, unsubscribed, bounced |
| `KPI` | with optional sparkline + delta |
| `Card` | with optional header bar |
| `Input` / `Select` / `Textarea` | with mono uppercase label, focus ring |
| `Dialog` | with scrim, header dot, footer actions |
| `Toast` | success / info / hot |
| `EmptyState` | dashed border, mono copy, amber link CTA |
| `Sidebar` + `NavItem` | active pill, signal dot pulse, rail collapse |

## Screens

| Screen | Notes |
|---|---|
| Login | Grid + amber-orb backdrop, Georgia welcome, Google CTA |
| Dashboard | 5-tile KPI strip with sparklines, Campaign Health table, Recent Activity |
| Campaigns | Row list, status pill, lead count, inline `Re-run Scout` / `Edit` / `Import CSV` |
| Campaign New | Form with AI-write helper, scout-progress states |
| Leads | Dense filterable/sortable table, state filter chips, bulk-action toolbar |
| Inbox | Split view: HOT/WARM list ← → thread + AI-draft composer |
| Settings | Google account, signature, sending limits, Telegram, team |

## Responsive notes

Desktop-first at **1440px**. Usable at **≥1024px**:
- Sidebar may collapse to icon rail on viewports < 1280px.
- Leads table hides website column < 1180px.
- Inbox split becomes single-pane modal stack < 1024px (out of scope for v1).
- Not designed for mobile.

## Keyboard

- `j` / `k` — next / previous lead (Leads, Inbox)
- `e` — archive / not interested (Inbox)
- `r` — reply (Inbox)
- `/` — focus search
- `⌘K` — open command palette (visual only in prototype)
