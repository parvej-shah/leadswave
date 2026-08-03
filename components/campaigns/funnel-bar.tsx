"use client";

type FunnelSegment = {
  label: string;
  value: number;
  color: string;
};

export function FunnelBar({ segments }: { segments: FunnelSegment[] }) {
  const total = segments[0]?.value ?? 0;

  return (
    <div className="flex items-start gap-0 overflow-hidden rounded-lg border border-border bg-surface">
      {segments.map((seg, i) => {
        const pct = total > 0 ? (seg.value / total) * 100 : 0;
        const conversionPct =
          i > 0 && segments[i - 1].value > 0
            ? Math.round((seg.value / segments[i - 1].value) * 100)
            : null;

        return (
          <div
            key={seg.label}
            className="flex-1 flex flex-col px-4 py-3 border-r border-border last:border-r-0 min-w-0"
          >
            <p
              className="font-sans text-[26px] font-semibold tabular-nums m-0 leading-none"
              style={{ color: seg.color }}
            >
              {seg.value}
            </p>
            <p className="font-mono text-[10px] text-fg-5 m-0 mt-1 uppercase tracking-wider truncate">
              {seg.label}
            </p>
            <div className="h-0.5 rounded-full bg-[oklch(0.18_0_0)] overflow-hidden w-full mt-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(pct, seg.value > 0 ? 4 : 0)}%`,
                  backgroundColor: seg.color,
                }}
              />
            </div>
            {conversionPct !== null && (
              <p className="font-mono text-[10px] text-fg-5 m-0 mt-1">
                {conversionPct}% of prev
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
