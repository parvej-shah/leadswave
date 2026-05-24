import * as React from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

export function DeltaPill({
  value,
  color = "var(--success)",
}: {
  value?: string;
  color?: string;
}) {
  if (!value) return null;
  const isUp = !value.startsWith("-") && !value.startsWith("↓");
  return (
    <span
      className="inline-flex items-center gap-[3px] font-mono text-[10px] tracking-[0.02em] px-1.5 py-px rounded-[3px] bg-white/[0.04]"
      style={{ color }}
    >
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
        <path
          d={isUp ? "M6 2 L10 8 L2 8 Z" : "M6 10 L2 4 L10 4 Z"}
          fill={color}
        />
      </svg>
      {value.replace(/^[+\-↑↓]\s*/, "")}
    </span>
  );
}

export function KPI({
  label,
  value,
  valueColor = "var(--fg-1)",
  spark,
  sparkColor,
  delta,
  deltaColor = "var(--fg-4)",
  deltaIsPill = false,
  sublabel,
  className,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  spark?: number[];
  sparkColor?: string;
  delta?: string;
  deltaColor?: string;
  deltaIsPill?: boolean;
  sublabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group bg-surface border border-border hover:border-border-strong rounded-xl px-4 py-3.5 transition-colors duration-200 relative overflow-hidden min-w-0",
        className
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.10em] text-fg-4 mb-2.5 truncate">
        {label}
      </p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="ds-kpi-value m-0" style={{ color: valueColor }}>
          {value}
        </p>
        {deltaIsPill && delta && <DeltaPill value={delta} color={deltaColor} />}
        {sublabel && (
          <span className="font-mono text-[10px] tracking-[0.04em] text-fg-4">
            {sublabel}
          </span>
        )}
      </div>
      {spark && (
        <div className="mt-3 -mx-0.5">
          <Sparkline data={spark} color={sparkColor || valueColor} height={28} width={200} />
        </div>
      )}
      {!deltaIsPill && delta && (
        <p
          className="font-mono text-[10px] mt-2.5 tracking-[0.08em] uppercase"
          style={{ color: deltaColor }}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
