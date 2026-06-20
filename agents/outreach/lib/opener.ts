/**
 * First-touch "soft opener" prompt builders, shared by email + WhatsApp.
 *
 * DELIVERABILITY INVARIANT (see .claude/features/outreach/rules.md):
 * First-touch outreach is an OPENER, not a pitch. It must read like a human
 * starting a conversation, because that is what survives spam filters and
 * WhatsApp's report-driven flagging.
 *
 * Allowed in message #1: one specific observation about the recipient, ONE
 * light sentence on what we do, and one low-pressure question.
 * NOT allowed in message #1: links/URLs, "book a call"/calendar CTAs, pricing,
 * hype words, or a full sales pitch. The pitch happens after they reply
 * (handled by the inbox warm/hot draft nodes).
 */

import type { OutreachLanguage } from "./locale";

export type OpenerContext = {
  /** Who the message is from (sender display name). */
  fromName?: string | null;
  /** Recipient business name. */
  companyName: string;
  /** Scraped website markdown or stored description; recipient context. */
  websiteSummary?: string | null;
  /** Category-specific framing from resolveOffer (no-website vs has-website). */
  angle?: string | null;
  /** What we offer — used only to keep the soft mention truthful, never pasted. */
  offer?: string | null;
  /** Optional recipient location, used to make the observation concrete. */
  location?: string | null;
};

const SHARED_RULES = `This is a FIRST message to someone who has never heard from us, so it is an opener, not a sales pitch:
- Open with ONE specific, genuine observation about THIS business, drawn from the info above — never generic flattery.
- You may include at most ONE short, soft sentence hinting at what we help with — phrased as context, not an offer.
- End with ONE low-pressure question about how they currently handle the relevant problem.
- Do NOT include any link or URL. Do NOT ask to "book a call" or propose a meeting. Do NOT mention pricing.
- No hype words, no "I hope this email finds you well", no fake urgency, no placeholders like [name].`;

/**
 * Shared language instruction for both channels. English is the default; any other
 * language must read as a native business owner wrote it, not a machine translation.
 * Generalizes the old Bangla-only WhatsApp rule to every supported language.
 */
function languageRule(language: OutreachLanguage): string {
  if (language === "English") return "- LANGUAGE: Write in plain, natural English.";
  return `- LANGUAGE: Write the entire message in natural, conversational ${language}, exactly as a local business owner in that market would write it — not a stiff machine translation. Names and brand terms may stay in their original form.`;
}

function contextBlock(ctx: OpenerContext): string {
  return [
    `About the recipient business:`,
    ctx.websiteSummary?.trim() || `Company: ${ctx.companyName}`,
    ctx.location ? `Location: ${ctx.location}` : "",
    ctx.angle ? `\nFraming: ${ctx.angle}` : "",
    ctx.offer?.trim() ? `\nWhat we help with (for your reference only — do not paste this in): ${ctx.offer.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Email opener prompt. Returns JSON `{ subject, body }`. */
export function buildEmailOpenerPrompt(
  ctx: OpenerContext,
  opts: { language: OutreachLanguage },
): string {
  return `You are writing a first-touch cold email on behalf of ${ctx.fromName || "our team"}.

${contextBlock(ctx)}

VOICE: Write like a real person who genuinely opened their website/listing two minutes ago
and is firing off a quick, curious note — not a marketer running a template. It must feel
hand-typed for THIS business, not mail-merged.

Write a short opener email. Rules:
- Subject: 3-6 words, lowercase-feeling, like a human typed it in a hurry. Reference ONE
  concrete thing about THEIR business (their name, what they do, or their city). Personal,
  not promotional. NO ALL CAPS, "Re:", clickbait, emojis, exclamation marks, the word
  "free", pricing, or our offer. Think "quick question about <their thing>", not
  "Grow your business with us".
- Body: 2-3 short sentences, max ~70 words. Follow the opener rules below.
${SHARED_RULES}
- Sign off as: ${ctx.fromName || "The team"}
${languageRule(opts.language)}

Good vs bad (match the GOOD tone, do not copy the words):
- GOOD subject: "quick question about <CompanyName>"
- BAD subject: "Boost Your Sales Today!! 🚀"
- GOOD body: "Saw <CompanyName> handles <specific thing from the info above> over in <city> —
  nice setup. We help shops like yours <one soft phrase>. Out of curiosity, how are you
  handling <relevant problem> right now?"
- BAD body: "We are a leading provider of solutions that help businesses like yours grow.
  Book a call to learn more about our services and pricing."

Return JSON only:
{ "subject": "...", "body": "..." }`;
}

/**
 * Per-step framing for follow-ups, so #2/#3/#4 diverge in angle, length, and
 * structure instead of converging on near-identical "just bumping" text
 * (near-identical messages are a spam signal).
 */
const FOLLOWUP_STEP_FRAMING: Record<number, string> = {
  2: "Angle: surface ONE concrete, specific idea or observation about their business they haven't heard from us yet. Keep it to a single sentence. No question.",
  3: "Angle: ask one short, genuine question about how they currently handle the relevant problem. Lighter and shorter than the previous note. No restating the offer.",
  4: "Angle: a graceful break-up note — acknowledge timing may be off, leave the door open, no ask. Warm, one or two sentences.",
};

/**
 * Follow-up prompt. Follow-ups stay opener-spirited: a soft nudge with a new
 * angle, NOT a renewed pitch or a "book a call" CTA. Each step (#2/#3/#4) is
 * framed differently so the thread doesn't read as a copy-paste sequence.
 * Returns plain text only — no greeting, no sign-off.
 */
export function buildFollowupPrompt(ctx: {
  followupNumber: number;
  companyName: string;
  angle?: string | null;
  offer?: string | null;
  priorOutbound: string;
}): string {
  const framing = FOLLOWUP_STEP_FRAMING[ctx.followupNumber] ?? FOLLOWUP_STEP_FRAMING[2];
  return `You are writing follow-up #${ctx.followupNumber} on a cold outreach thread.
Company: ${ctx.companyName}
${ctx.angle ? `Framing: ${ctx.angle}\n` : ""}${ctx.offer?.trim() ? `What we help with (reference only, do not paste): ${ctx.offer.trim()}\n` : ""}Prior messages we already sent (do NOT repeat their wording or structure):
${ctx.priorOutbound || "(none)"}

${framing}

Hard rules:
- Vary the wording and sentence shape from the prior messages above — this must not read like a templated bump.
- No links/URLs, no "book a call"/meeting CTA, no pricing, no hype.
- Plain text only, no greeting, no sign-off.`;
}

/** WhatsApp opener prompt. Returns the message text only. */
export function buildWhatsAppOpenerPrompt(
  ctx: OpenerContext,
  opts: { language: OutreachLanguage },
): string {
  return `You are writing a first-touch WhatsApp message on behalf of ${ctx.fromName || "our team"} to a local business.

${contextBlock(ctx)}

Write the WhatsApp message. Rules:
- WhatsApp tone: warm, casual, like texting a busy business owner — not a formal email.
${SHARED_RULES}
- 2-4 short sentences, max ~60 words. No markdown, at most one emoji.
${languageRule(opts.language)}
Return the message text only.`;
}
