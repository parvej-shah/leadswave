# WhatsApp outreach — purpose

**Job:** generate first-touch WhatsApp opener messages for leads with a phone number.

**Code:** `app/api/leads/whatsapp-message/route.ts`. Uses the shared
`agents/outreach/lib/context.ts` (recipient context) and
`agents/outreach/lib/opener.ts` (`buildWhatsAppOpenerPrompt`). Write-language is resolved
from the campaign country via the shared `agents/outreach/lib/locale.ts`
(`resolveLanguage`) — local language for non-English-fluent markets, English default. The
AI-down fallback only curates Bangla + English; other languages fall back to the English
opener rather than ship unreviewed machine copy.

**Important scope:** the app **only drafts** the message. It does **not** send WhatsApp and
does **not** pace/throttle sending — that happens manually (copy out, send from a phone) or
via an external tool. So the anti-ban rules in `rules.md` are operational guidance for the
human/sender, not something the current code enforces. If a real send pipeline is ever
added, it MUST encode the volume + warm-up limits below.

**Why this matters:** WhatsApp flags accounts that message non-contacts, send
near-identical messages rapidly, get reported, or use automation on a personal/business
number. A flag = temporary restriction; repeat offenses = permanent ban. (Learned the hard
way — 2026-06-17 restriction.)
