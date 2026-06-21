/**
 * Client-safe (no Node deps) plain-text → minimal HTML for seeding the rich-text
 * editor with AI-generated plain drafts. Splits on blank lines into paragraphs
 * and turns single newlines into <br/>. Escapes HTML special chars.
 */
export function plainToHtml(text: string | null | undefined): string {
  if (!text || !text.trim()) return "";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p>${escape(para).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/**
 * Client-safe HTML → plain text (no Node deps). Inserts newlines at block
 * boundaries, then drops tags. Mirrors the server `htmlToPlainText` closely
 * enough for the Settings preview; the server value is authoritative on send.
 */
export function htmlToPlainTextClient(html: string | null | undefined): string {
  if (!html) return "";
  const withBreaks = html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(ul|ol)>/gi, "\n");
  if (typeof window !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = withBreaks;
    return (el.textContent ?? "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
  }
  // SSR fallback: crude tag strip (preview only renders client-side anyway).
  return withBreaks.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * The delimiter `appendOpenerSignature` / `buildOutboundEmail` put before a
 * signature (RFC-3676-style "-- " sig separator). Single source of truth so the
 * stored body (which now includes the signature, to mirror what was sent) can be
 * trimmed back to just the message when feeding AI follow-up prompts.
 */
export const SIGNATURE_DELIMITER = "\n--\n";

/** Remove the trailing signature block from a stored body for AI prompt context. */
export function stripSignature(text: string | null | undefined): string {
  if (!text) return "";
  const i = text.indexOf(SIGNATURE_DELIMITER);
  return (i === -1 ? text : text.slice(0, i)).trim();
}

/**
 * Strip every URL from plain text. Used on the first-touch opener path: the
 * signature is permanent, but the opener invariant forbids links/URLs in
 * message #1, so we keep the name/contact lines and drop bare URLs. Pure string
 * ops (no Node deps) so the Settings signature preview can show the same result
 * the server produces — this is the single source of truth for both.
 */
export function stripUrls(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    // Bare domains like "leadswave.com" or "leadswave.com/x", but NOT email
    // addresses (the "@" lookbehind protects alex@leadswave.com) and not
    // decimals. Requires a known-ish TLD shape (2+ letters).
    .replace(/(?<![@\w.])\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?/gi, "")
    // Tidy separators (·, |, commas) left dangling where a link was removed.
    .replace(/(^|\n)[ \t]*[·|,]+[ \t]*/g, "$1")
    .replace(/[ \t]*[·|,]+[ \t]*(?=\n|$)/g, "")
    .replace(/[ \t]*[·|]{1}[ \t]*[·|]{1}[ \t]*/g, " · ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
