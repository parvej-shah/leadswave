import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "font-mono text-[10px] px-1.5 py-px rounded-[3px] bg-[oklch(0.18_0_0)] text-fg-3 border border-[oklch(0.25_0_0)] border-b-2",
        className
      )}
      {...props}
    />
  );
}
