"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
}) {
  const sizeClass =
    size === "sm" ? "px-2 py-[3px] text-[10px]" : "px-2.5 py-[5px] text-[11px]";
  return (
    <div
      className={cn(
        "inline-flex p-0.5 rounded-md bg-[oklch(0.13_0_0)] border border-[oklch(0.20_0_0)] gap-px",
        className
      )}
    >
      {options.map((o) => {
        const isActive = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "font-mono uppercase tracking-[0.06em] rounded-[4px] border-0 cursor-pointer transition-colors duration-150",
              sizeClass,
              isActive ? "bg-[oklch(0.18_0_0)] text-fg-1" : "bg-transparent text-fg-4 hover:text-fg-3"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
