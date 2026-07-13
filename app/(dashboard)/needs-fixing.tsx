"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";

export type FixItem = {
  id: string;
  summary: string;
  fix: string | null;
  createdAt: string;
};

/**
 * Red strip above Needs-Attention: actionable failures logged by the cron /
 * agents (logError). Dismiss is client-side only — the event stays in the
 * feed; the 24h dedupe in logError keeps it from reappearing every run.
 */
export function NeedsFixing({ items }: { items: FixItem[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden border animate-in fade-in slide-in-from-top-2 duration-200"
      style={{ borderColor: "var(--hot-border)", background: "var(--hot-tinted-surface)" }}
    >
      <div className="flex items-center gap-2.5 px-[18px] py-2.5 border-b" style={{ borderColor: "var(--hot-border)" }}>
        <span className="text-[13px]">⚠</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.10em] font-semibold" style={{ color: "var(--hot)" }}>
          Needs fixing
        </span>
        <span className="ml-auto font-mono text-[10px] text-fg-4">
          {visible.length} issue{visible.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-col">
        {visible.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-[18px] py-2.5 border-b last:border-b-0"
            style={{ borderColor: "color-mix(in oklch, var(--hot-border) 50%, transparent)" }}
          >
            <p className="font-sans text-[13px] text-fg-1 m-0 flex-1 min-w-0 leading-[1.4]">
              {item.summary}
            </p>
            {item.fix && (
              <Link
                href={item.fix}
                className="font-mono text-[11px] shrink-0 inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ color: "var(--hot)" }}
              >
                Fix
                <Icon name="arrow" size={11} />
              </Link>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-fg-4 hover:text-fg-1 transition-colors"
              onClick={() => setDismissed((prev) => new Set(prev).add(item.id))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
