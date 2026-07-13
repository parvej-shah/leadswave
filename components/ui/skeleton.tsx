import * as React from "react";
import { cn } from "@/lib/utils";

/** Pulsing placeholder block. Size it with className (h-*, w-*). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("ds-pulse rounded bg-[oklch(0.14_0_0)]", className)}
      {...props}
    />
  );
}

/** Row-list placeholder matching the leads/inbox/queue row heights. */
export function SkeletonRows({
  n = 5,
  rowClassName,
}: {
  n?: number;
  rowClassName?: string;
}) {
  return (
    <div aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-12 ds-pulse border-b border-border-soft last:border-b-0 bg-[oklch(0.12_0_0)]",
            rowClassName,
          )}
          style={{ animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}
