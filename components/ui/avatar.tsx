import * as React from "react";
import { cn } from "@/lib/utils";

const PALETTE = [
  "oklch(0.75 0.13 35)",
  "oklch(0.72 0.10 220)",
  "oklch(0.72 0.10 145)",
  "oklch(0.70 0.12 320)",
  "oklch(0.74 0.11 90)",
  "oklch(0.70 0.13 265)",
];

export function Avatar({
  name,
  size = 24,
  color,
  className,
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const c = color || PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];
  const initial = (name[0] || "?").toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-mono font-semibold flex-shrink-0 border",
        className
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size > 28 ? 6 : 4,
        background: `color-mix(in oklch, ${c} 14%, var(--surface))`,
        color: c,
        borderColor: `color-mix(in oklch, ${c} 22%, transparent)`,
        fontSize: size > 28 ? 11 : 10,
      }}
    >
      {initial}
    </span>
  );
}
