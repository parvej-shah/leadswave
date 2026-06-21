"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable rich-text viewer. Renders stored message/signature HTML.
 *
 * Trust model: HTML is sanitized SERVER-SIDE at the write boundary
 * (lib/html/sanitize.ts) before it is ever stored or sent. This component does
 * a second, client-safe allowlist pass as defense-in-depth, then renders.
 * When `html` is absent (legacy / AI-generated plain messages) it falls back to
 * the plain-text `body` with preserved whitespace.
 */
export type RichTextViewerProps = {
  html?: string | null;
  /** Plain-text fallback when there is no HTML. */
  text?: string | null;
  className?: string;
};

const ALLOWED = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "UL", "OL", "LI", "BLOCKQUOTE", "CODE", "PRE",
  "H1", "H2", "H3", "H4", "A", "SPAN", "DIV", "HR",
]);

/** Client-side allowlist scrub using the DOM — no markup leaves with scripts/handlers. */
function scrub(dirty: string): string {
  if (typeof window === "undefined") return dirty; // SSR: server already sanitized
  const doc = new DOMParser().parseFromString(dirty, "text/html");
  doc.body.querySelectorAll("*").forEach((el) => {
    if (!ALLOWED.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const ok =
        (el.tagName === "A" && ["href", "title", "target", "rel"].includes(name)) ||
        (el.tagName === "SPAN" && name === "style");
      if (!ok) el.removeAttribute(attr.name);
    }
    if (el.tagName === "A") {
      const href = el.getAttribute("href") ?? "";
      if (!/^(https?:|mailto:|tel:)/i.test(href)) el.removeAttribute("href");
      el.setAttribute("rel", "noopener noreferrer");
      el.setAttribute("target", "_blank");
    }
  });
  return doc.body.innerHTML;
}

export function RichTextViewer({ html, text, className }: RichTextViewerProps) {
  const clean = React.useMemo(() => (html ? scrub(html) : ""), [html]);

  if (!clean) {
    return (
      <div className={cn("rte-content whitespace-pre-wrap", className)}>{text ?? ""}</div>
    );
  }
  return (
    <div className={cn("rte-content", className)} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
