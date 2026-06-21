import sanitizeHtml from "sanitize-html";

/**
 * Server-side HTML sanitizer for rich-text we persist or email out.
 *
 * This is the trust boundary: every piece of user-authored HTML (signature,
 * reply/compose bodies) is run through here BEFORE it is stored or sent, so the
 * client viewer can render stored HTML without re-sanitizing on every paint.
 * Node-only (`sanitize-html`) — never import this into a "use client" file.
 */
const ALLOWED_TAGS = [
  "p", "br", "b", "strong", "i", "em", "u", "s", "strike",
  "ul", "ol", "li", "blockquote", "code", "pre",
  "h1", "h2", "h3", "h4", "a", "span", "div", "hr",
];

export function sanitizeRichText(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      span: ["style"],
      "*": [],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        "font-weight": [/^bold$/, /^\d{3}$/],
        "font-style": [/^italic$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      // force safe link behavior on any anchor that survives
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

/** Plain-text projection of HTML — used for the text/* email part and previews. */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  // Insert newlines for block boundaries BEFORE stripping tags — otherwise
  // sanitize-html joins <p>a</p><p>b</p> into "ab" with no separation.
  const withBreaks = html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(ul|ol)>/gi, "\n");
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// stripUrls lives in the client-safe lib/html/plain.ts (pure string ops, no Node
// deps) so the Settings preview and the server produce identical output. Re-export
// here so server callers can keep importing from one place.
export { stripUrls } from "./plain";
