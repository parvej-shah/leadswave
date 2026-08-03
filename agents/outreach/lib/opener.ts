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

/**
 * Per-lead structural variety. The biggest cold-email spam signal isn't tone —
 * it's that every message shares the same skeleton (same subject pattern, same
 * "Saw X… we help… out of curiosity" body shape, same stock phrases). A single
 * few-shot makes the model converge on one mold. So we deterministically rotate
 * the subject pattern and the body's opening move per lead (seeded by company
 * name → stable per lead, spread across leads) and ban the phrases that recur.
 */
const SUBJECT_STYLES = [
  `a short question about something specific they do (do NOT start with the word "quick")`,
  `a 2-4 word noun phrase naming the specific thing you noticed (no verb, no "question")`,
  `a casual lowercase fragment that reads like an internal note to yourself about them`,
  `their company or city name plus one concrete detail, comma-separated`,
  `a single curious word or two about their work — understated, almost cryptic`,
];

const BODY_OPENINGS = [
  `Open by naming the SPECIFIC thing you noticed about them, stated plainly — no "I came across" / "I was looking at" preamble.`,
  `Open mid-thought, as if continuing a thought — lead with what struck you about their work, not with how you found them.`,
  `Open with a genuine one-line reaction to something concrete on their site/listing, then the soft line.`,
  `Open with the low-pressure question itself, then briefly say why it caught your eye. (Question can come first.)`,
  `Open by referencing their location or niche and one specific detail, conversational.`,
];

/** Stable non-negative hash of a string, for deterministic per-lead rotation. */
function seedIndex(seed: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % modulo;
}

/** Phrases that kept recurring across drafts — banned so messages don't cluster. */
const BANNED_PHRASES = [
  `"quick question about/for ..." as a subject`,
  `"nothing slips through the cracks"`,
  `"you guys"`,
  `"came across" / "was just looking at" as the opening words`,
  `"out of curiosity"`,
  `"how are you currently tracking/managing ..."`,
];

function varietyBlock(seed: string): string {
  const subject = SUBJECT_STYLES[seedIndex(seed, SUBJECT_STYLES.length)];
  const body = BODY_OPENINGS[seedIndex(seed + "::body", BODY_OPENINGS.length)];
  return `STRUCTURE (vary it — these messages must NOT look mass-produced):
- Subject shape for THIS email: ${subject}
- Body opening for THIS email: ${body}
- Do NOT reuse any of these worn phrases (every sender uses them — they read as spam):
${BANNED_PHRASES.map((p) => `  · ${p}`).join("\n")}`;
}

export function parseAngle(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { pain?: string; hook?: string; avoid?: string };
    const parts: string[] = [];
    if (parsed.pain) parts.push(`Pain to address: ${parsed.pain}`);
    if (parsed.hook) parts.push(`Hook / observation angle: ${parsed.hook}`);
    if (parsed.avoid) parts.push(`Things to avoid mentioning: ${parsed.avoid}`);
    return parts.length > 0 ? parts.join("\n") : raw;
  } catch {
    return raw;
  }
}

function contextBlock(ctx: OpenerContext): string {
  const formattedAngle = parseAngle(ctx.angle);
  return [
    `About the recipient business:`,
    ctx.websiteSummary?.trim() || `Company: ${ctx.companyName}`,
    ctx.location ? `Location: ${ctx.location}` : "",
    formattedAngle ? `\nFraming / Angle:\n${formattedAngle}` : "",
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

${varietyBlock(ctx.companyName)}

Write a short opener email. Rules:
- Subject: 3-6 words, lowercase-feeling, like a human typed it in a hurry — following the
  subject shape above. Reference ONE concrete thing about THEIR business. Personal, not
  promotional. NO ALL CAPS, "Re:", clickbait, emojis, exclamation marks, the word "free",
  pricing, or our offer.
- Body: 2-3 short sentences, max ~70 words, following the body opening above.
${SHARED_RULES}
- Do NOT include a sign-off or sender name — the signature is appended separately.
- Use correct grammar, spelling, and punctuation throughout — no typos, no missing articles, no broken sentences.
${languageRule(opts.language)}

Tone reference only — DO NOT reuse this wording, structure, or phrasing; it is a register
example, not a template:
- A bad email reads like: "We are a leading provider of solutions that help businesses like
  yours grow. Book a call to learn more about our services and pricing."
- A good email sounds like a curious human who actually looked at their work and asked a
  real question — but find your OWN words and your OWN opening for this specific business.

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
- Use correct grammar, spelling, and punctuation throughout.
- Plain text only, no greeting, no sign-off.`;
}

/** WhatsApp opener prompt. Returns the message text only. */
export function buildWhatsAppOpenerPrompt(
  ctx: OpenerContext,
  opts: { language: OutreachLanguage },
): string {
  return `You are writing a first-touch WhatsApp text message to ${ctx.companyName}.

${contextBlock(ctx)}

CRITICAL WHATSAPP COMPLIANCE & ANTI-SPAM FRAMING:
- You are reaching out personally as a local contractor, customer, or industry peer inquiring about their services.
- NEVER sound like a marketer, agency, or software vendor.
- STRICTLY FORBIDDEN: Do NOT mention "AI", "automation", "lead generation", "agency", "marketing", "software", or "booking a call".
- Keep it extremely short (1-2 sentences, max 30 words).
- Tone: warm, natural, personal, as if texting a local business owner directly.
- Open with a polite greeting and a genuine question about their work or project availability in ${ctx.location || "their area"}.
${languageRule(opts.language)}
Return the message text only.`;
}
