import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center font-mono uppercase tracking-[0.08em] whitespace-nowrap rounded-[4px] border",
  {
    variants: {
      variant: {
        hot: "text-hot bg-hot-bg border-hot-border",
        warm: "text-amber bg-amber-bg border-amber-border",
        success: "text-success bg-success-bg border-success-border",
        info: "text-info bg-info-bg border-info-border",
        neutral: "text-fg-4 bg-[oklch(0.16_0_0)] border-[oklch(0.25_0_0)]",
        destructive:
          "text-[oklch(0.55_0.12_25)] bg-[oklch(0.16_0.03_25)] border-[oklch(0.28_0.06_25)]",
      },
      size: {
        sm: "text-[10px] px-1.5 py-px",
        md: "text-[10px] px-[7px] py-[2px]",
        lg: "text-[11px] px-[9px] py-[3px]",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export type LeadState =
  | "discovered"
  | "contacted"
  | "replied"
  | "converted"
  | "meeting_booked"
  | "unsubscribed"
  | "bounced";

const STATE_MAP: Record<
  LeadState,
  { variant: BadgeProps["variant"]; label: string }
> = {
  discovered: { variant: "neutral", label: "DISCOVERED" },
  contacted: { variant: "warm", label: "CONTACTED" },
  replied: { variant: "success", label: "REPLIED" },
  converted: { variant: "success", label: "CONVERTED" },
  meeting_booked: { variant: "info", label: "MEETING" },
  unsubscribed: { variant: "destructive", label: "UNSUB" },
  bounced: { variant: "destructive", label: "BOUNCED" },
};

export function StateBadge({
  state,
  size,
}: {
  state: LeadState | string;
  size?: BadgeProps["size"];
}) {
  const entry = STATE_MAP[state as LeadState] ?? STATE_MAP.discovered;
  return (
    <Badge variant={entry.variant} size={size}>
      {entry.label}
    </Badge>
  );
}
