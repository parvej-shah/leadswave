import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * DataCard — compact card used to render a table row on mobile (below `md`).
 * Desktop keeps its CSS-grid table; the same row data is mapped into DataCards
 * inside an `md:hidden` block. Purely presentational; logic stays in the page.
 */
export function DataCard({
  className,
  onClick,
  selected,
  children,
}: {
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "bg-surface border rounded-lg p-3 flex flex-col gap-2.5 transition-colors duration-150",
        onClick && "cursor-pointer hover:border-border-strong",
        selected ? "border-amber-border" : "border-border",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Title row: leading content (name) on the left, trailing slot (badge) on the right. */
export function DataCardTitle({
  children,
  trailing,
  className,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-2 min-w-0", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing != null && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

/** Meta line — small muted facts, separated by middots when multiple. */
export function DataCardMeta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-fg-4 min-w-0",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Actions row — buttons wrap; pushed to its own line under the meta. */
export function DataCardActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 pt-0.5", className)}>{children}</div>
  );
}
