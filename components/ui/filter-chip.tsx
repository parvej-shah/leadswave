"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function FilterChip({
  active,
  count,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  count?: number;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.06em] px-2.5 py-[5px] rounded-full border cursor-pointer inline-flex items-center gap-1.5 transition-colors duration-150",
        active
          ? "bg-amber-bg text-amber border-amber-border"
          : "bg-transparent text-fg-4 border-[oklch(0.20_0_0)] hover:text-fg-3 hover:border-[oklch(0.26_0_0)]",
        className
      )}
    >
      {children}
      {count !== undefined && <span className="opacity-60">· {count}</span>}
    </button>
  );
}
