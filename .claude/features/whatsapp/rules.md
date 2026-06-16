# WhatsApp outreach — rules

Message content is governed by `agents/outreach/lib/opener.ts` (opener, not pitch — see
`features/outreach/rules.md`). The rules below are the **anti-ban operating limits**.

## Per-number daily volume (warm-up ramp)

A new number must be warmed up — do not start at full volume:
- Week 1–2 (new number): **max 10** new contacts/day.
- Week 3–4: **max 20–25**/day.
- After ~1 month of healthy usage: **max 40–50**/day.

## Before sending any message

- **Save the recipient as a contact first.** Never message a number that isn't saved.
- Wait **30–60 seconds** between each new message — no rapid bursts.
- **Vary the wording** every time. Never copy-paste the same text (this is why message
  generation is per-lead and opener-style, not templated).
- Opener only: no link, no "send me a video"/big ask in message #1. The pitch comes after
  they reply.

## Infrastructure

- Use a **dedicated SIM/number for outreach** — keep the personal number clean.
- Personal WA number = high risk. Dedicated WA Business number (separate SIM) = medium.
- Past ~50 messages/day, move to the **WhatsApp Business API** via an approved provider
  (WATI / 360dialog, ~$30–50/mo) — approved channels don't get banned for volume.

## If flagged

- A countdown timer (~6h) = temporary restriction. Stop all cold messages from that number
  for the day; wait it out. Repeat offenses → permanent ban.

## If a send pipeline is ever built into the app

It MUST enforce: contact-saved check, 30–60s inter-message delay, per-number daily cap with
the warm-up ramp above, and per-message wording variation. Do not ship an unthrottled
WhatsApp blaster.
