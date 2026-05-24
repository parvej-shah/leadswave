import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 font-mono tracking-[0.01em] whitespace-nowrap rounded-md border border-transparent transition-[background-color,color,border-color,opacity,box-shadow] duration-150 ease-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  {
    variants: {
      variant: {
        primary:
          "bg-amber text-canvas font-semibold shadow-[inset_0_1px_0_oklch(1_0_0/25%)] hover:bg-amber-hover",
        secondary:
          "bg-[oklch(0.13_0_0)] text-fg-2 border-[oklch(0.22_0_0)] shadow-[inset_0_1px_0_oklch(1_0_0/4%)] hover:bg-[oklch(0.16_0_0)] hover:border-[oklch(0.28_0_0)]",
        ghost: "bg-transparent text-fg-3 hover:bg-[oklch(0.13_0_0)] hover:text-fg-1",
        destructive:
          "bg-hot-bg text-hot border-hot-border hover:bg-[oklch(0.70_0.20_25/22%)]",
        tinted:
          "bg-amber-bg text-amber border-amber-border hover:bg-[oklch(0.78_0.18_65/22%)]",
        success:
          "bg-success-bg text-success border-success-border hover:bg-[oklch(0.72_0.18_145/22%)]",
        info: "bg-info-bg text-info border-info-border hover:bg-[oklch(0.65_0.18_260/22%)]",
      },
      size: {
        sm: "text-[11px] px-2.5 py-[5px] font-medium",
        md: "text-[13px] px-[13px] py-[7px] font-medium",
        lg: "text-[14px] px-4 py-2.5 font-medium",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    iconStart?: IconName;
    iconEnd?: IconName;
    kbd?: string;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, fullWidth, iconStart, iconEnd, kbd, children, type = "button", ...props },
    ref
  ) {
    const iconSize = size === "sm" ? 12 : 14;
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        {...props}
      >
        {iconStart && <Icon name={iconStart} size={iconSize} />}
        {children}
        {iconEnd && <Icon name={iconEnd} size={iconSize} />}
        {kbd && (
          <span
            className={cn(
              "ml-1 px-[5px] py-[1px] rounded-[3px] font-mono text-[10px]",
              variant === "primary"
                ? "bg-black/[0.18] text-black/60"
                : "bg-white/[0.06] text-fg-4"
            )}
          >
            {kbd}
          </span>
        )}
      </button>
    );
  }
);
