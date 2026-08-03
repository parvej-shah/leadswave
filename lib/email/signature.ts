import { sanitizeRichText, htmlToPlainText, stripUrls } from "@/lib/html/sanitize";
import { SIGNATURE_DELIMITER } from "@/lib/html/plain";
import { stripInlineSignoff } from "@/lib/email/template-tags";

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
  const sigText = (input.signatureText || htmlToPlainText(cleanSigHtml)).trim();

  // If a signature is provided, strip any inline manual sign-offs to prevent double signatures
  const sanitizedBodyText = (cleanSigHtml || sigText)
    ? stripInlineSignoff(input.bodyText)
    : input.bodyText.trim();

  // HTML side: prefer composed HTML; otherwise wrap the plain text in <p>.
  const bodyHtmlPart = cleanBodyHtml || `<p>${escapeHtml(sanitizedBodyText).replace(/\n/g, "<br/>")}</p>`;
  const html = cleanSigHtml
    ? `${bodyHtmlPart}<br/><hr/>${cleanSigHtml}`
    : bodyHtmlPart;

  // Text side: composed/plain body + plain signature.
  const text = sigText ? `${sanitizedBodyText}\n${SIGNATURE_DELIMITER}${sigText}` : sanitizedBodyText;

  // What we persist on the Message row: the composed body + signature, so the
  // thread viewer shows exactly what was sent.
  const storedHtml = cleanSigHtml ? `${bodyHtmlPart}<hr/>${cleanSigHtml}` : (cleanBodyHtml || null);

  return { html, text, bodyHtml: storedHtml, bodyText: text };
}

export function appendOpenerSignature(
  bodyText: string,
  signatureText?: string | null,
  signatureHtml?: string | null,
): string {
  const raw = (signatureText || htmlToPlainText(signatureHtml ?? "")).trim();
  const sig = stripUrls(raw);
  const cleanText = sig ? stripInlineSignoff(bodyText) : bodyText.trim();
  return sig ? `${cleanText}\n${SIGNATURE_DELIMITER}${sig}` : cleanText;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
