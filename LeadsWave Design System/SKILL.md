---
name: leadswave-design
description: Use this skill to generate well-branded interfaces and assets for LeadsWave, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the LeadsWave outbound-sales web app.
user-invocable: true
---

# LeadsWave Design Skill

LeadsWave is an outbound sales automation tool — AI agents scout target companies, send cold emails, classify replies as HOT/WARM, draft responses, and book meetings on Google Calendar. The aesthetic is **dark-only, terminal/trading-desk**: think Linear × Vercel × Bloomberg Terminal.

## How to use this skill

1. **Read `README.md`** first — it has the visual foundations, content rules, iconography conventions, and a manifest of every other file.
2. **Pull tokens from `colors_and_type.css`** — import it (or copy the relevant `:root` variables) into any new mock. Variable names map onto the existing globals.css names where they exist.
3. **Open `preview/`** to scan the design-system cards (colors, type, spacing, badges, buttons, KPI cards, table, nav, message bubbles).
4. **Lift components from `ui_kits/leadswave-app/`** — `components.jsx` has Button / Badge / Card / Input / KPI / Dialog / Toast / EmptyState / Sparkline / DirectionTag / Kbd / FilterChip. `screens/` has the eight canonical screens (Login, Dashboard, Campaigns, CampaignNew, Leads, Inbox, Settings).
5. **Open `signature.html`** for the 4-frame HOT-lead-to-sent-reply story — useful when you need to demonstrate motion or a complete interaction arc.

## Rules of thumb

- **Monospace dominates.** DM Mono for nav, labels, table headers, badges, buttons, KPI labels, timestamps. Sans (Inter) for body and headings. Georgia is reserved for the auth welcome moment only.
- **Color is semantic.** Amber = brand + primary CTA. Hot = HOT + destructive. Success = replied/converted. Info = meetings. No decorative color.
- **No drop shadows.** Elevation is communicated by surface step (0.09 → 0.10 → 0.14 → 0.16).
- **Borders are translucent white** at 4 / 7 / 12% — never solid hex.
- **Badges:** 10–11px mono, UPPERCASE, `15%` tinted bg + matching text + `30%` border.
- **Empty states:** dashed border, mono muted copy, single amber link CTA.
- **Real-time-ish copy:** "12m ago", lowercase progress ("scouting leads…"), no "Welcome!" greetings.

## What to output

If creating visual artifacts (slides, mocks, throwaway prototypes), copy `colors_and_type.css` and any needed assets into your output and produce static HTML. The UI kit components are written as inline-styled React with no build step — they paste cleanly into any artifact using React via Babel-standalone.

If working on production code, the design system maps onto the existing Next.js + Tailwind + shadcn setup; the variables in `colors_and_type.css` align with the codebase's `app/globals.css` token names, so you can drop them in directly.

If the user invokes this skill without other guidance, ask them what they want to build — a new screen, a feature mockup, a marketing one-pager, a slide on the product? — and confirm whether they want desktop-only (yes, almost always) or also need ≥1024px laptop fallback. Then act as an expert designer outputting HTML artifacts or production code, depending on the need.

## Caveats

- The codebase uses `next/font` with **Geist** Sans/Mono. This system substitutes **DM Mono** (the explicit spec) and **Inter** in place of Geist Sans. If you have the production font files, drop them into `fonts/` and update the `@import` in `colors_and_type.css`.
- Icons are inlined (Lucide path data) inside `components.jsx` rather than pulled from the `lucide-react` package — same shapes, just unbundled.
- This system is **dark-only by design**. There is no light mode and there will not be one. Do not invent one if asked vaguely.
