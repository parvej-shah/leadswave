import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toastVariants = cva(
  "inline-flex items-center gap-2.5 px-3.5 py-2 rounded-md border font-mono text-[12px] tracking-[0.02em]",
  {
    variants: {
      kind: {
        success: "bg-success-tinted-surface text-success border-success-border",
        info: "bg-info-tinted-surface text-info border-info-border",
        hot: "bg-hot-tinted-surface text-hot border-hot-border",
        amber: "bg-amber-tinted-surface text-amber border-amber-border",
      },
    },
    defaultVariants: { kind: "success" },
  }
);

export type ToastProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof toastVariants> & {
    pill?: string;
  };

export function Toast({ kind, pill, className, children, ...props }: ToastProps) {
  return (
    <div className={cn(toastVariants({ kind }), className)} {...props}>
      {pill && (
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] px-1.5 py-px rounded-[3px] bg-white/[0.06]">
          {pill}
        </span>
      )}
      {children}
    </div>
  );
}
