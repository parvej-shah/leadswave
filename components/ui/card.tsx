import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-xl overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  action,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { action?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-5 py-3 border-b border-border",
        className
      )}
      {...props}
    >
      <span className="font-mono text-[13px] text-fg-2 font-medium">{children}</span>
      {action}
    </div>
  );
}

export function CardBody({
  className,
  padded = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return <div className={cn(padded && "px-5 py-4", className)} {...props} />;
}
