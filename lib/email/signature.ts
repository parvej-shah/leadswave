import { sanitizeRichText, htmlToPlainText, stripUrls } from "@/lib/html/sanitize";
import { SIGNATURE_DELIMITER } from "@/lib/html/plain";

/**
 * Append the operator's reusable signature to an outgoing message, producing the
 * multipart bits Resend wants (`html` + `text`) and the values we persist on the
 * Message (`bodyHtml` + `body`).
 *
 * The signature is the single source of the sender's display name now — there is
 * no separate "sender name" line; the operator writes their name into the
 * signature in Settings. The body the user composed is wrapped/sanitized and the
 * signature appended once, separated by a divider.
 *
 * NOTE: first-touch openers do NOT use this multipart builder — they stay
 * text-only for deliverability. They still get the (permanent) signature, but
 * via `appendOpenerSignature` below, which keeps it plain text and strips URLs
 * (the opener invariant forbids links in message #1).
 */
export function buildOutboundEmail(input: {
  /** Raw composed HTML (may be empty if the composer was plain). */
  bodyHtml?: string | null;
  /** Plain-text body (always present — canonical). */
  bodyText: string;
  signatureHtml?: string | null;
  signatureText?: string | null;
}): { html: string; text: string; bodyHtml: string | null; bodyText: string } {
  const cleanBodyHtml = input.bodyHtml ? sanitizeRichText(input.bodyHtml) : "";
  const cleanSigHtml = input.signatureHtml ? sanitizeRichText(input.signatureHtml) : "";

  // HTML side: prefer composed HTML; otherwise wrap the plain text in <p>.
  const bodyHtmlPart = cleanBodyHtml || `<p>${escapeHtml(input.bodyText).replace(/\n/g, "<br/>")}</p>`;
  const html = cleanSigHtml
    ? `${bodyHtmlPart}<br/><hr/>${cleanSigHtml}`
    : bodyHtmlPart;

  // Text side: composed/plain body + plain signature.
  const sigText = (input.signatureText || htmlToPlainText(cleanSigHtml)).trim();
  const text = sigText ? `${input.bodyText.trim()}\n${SIGNATURE_DELIMITER}${sigText}` : input.bodyText.trim();

  // What we persist on the Message row: the composed body + signature, so the
  // thread viewer shows exactly what was sent.
  const storedHtml = cleanSigHtml ? `${bodyHtmlPart}<hr/>${cleanSigHtml}` : (cleanBodyHtml || null);

  return { html, text, bodyHtml: storedHtml, bodyText: text };
}

/**
 * First-touch opener signature: PERMANENT but link-free and plain text.
 * Returns the text to send AND the value to persist as `body` (kept identical so
 * the thread shows what was sent). The opener stays text-only — no HTML part.
 */
export function appendOpenerSignature(
  bodyText: string,
  signatureText?: string | null,
  signatureHtml?: string | null,
): string {
  const raw = (signatureText || htmlToPlainText(signatureHtml ?? "")).trim();
  const sig = stripUrls(raw);
  return sig ? `${bodyText.trim()}\n${SIGNATURE_DELIMITER}${sig}` : bodyText.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
