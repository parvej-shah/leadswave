import * as React from "react";

const MAP = {
  outbound: { color: "var(--fg-4)", text: "YOU →" },
  inbound: { color: "var(--success)", text: "← THEM" },
  system: { color: "var(--info)", text: "AI DRAFT" },
} as const;

export type Direction = keyof typeof MAP;

export function DirectionTag({ dir }: { dir: Direction | string }) {
  const entry = (MAP as Record<string, (typeof MAP)[Direction]>)[dir] ?? MAP.outbound;
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-[0.08em]"
      style={{ color: entry.color }}
    >
      {entry.text}
    </span>
  );
}
