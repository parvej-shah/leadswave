import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-dashed border-[oklch(0.22_0_0)] rounded-lg px-6 py-12 text-center",
        className
      )}
    >
      <p className="font-mono text-[13px] text-fg-4 m-0 mb-3">{children}</p>
      {action &&
        (action.href ? (
          <a
            href={action.href}
            className="font-mono text-[13px] text-amber underline underline-offset-4 cursor-pointer"
          >
            {action.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="font-mono text-[13px] text-amber underline underline-offset-4 cursor-pointer bg-transparent border-0 p-0"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
