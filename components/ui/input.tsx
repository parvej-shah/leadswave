"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icon";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-4",
        className
      )}
      {...props}
    />
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  hint?: string;
  error?: string;
  iconStart?: IconName;
  onClear?: () => void;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, hint, error, iconStart, onClear, id, className, value, ...props }, ref) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    return (
      <div className="flex flex-col">
        {label && <Label htmlFor={inputId}>{label}</Label>}
        <div className="relative">
          {iconStart && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-4 pointer-events-none flex">
              <Icon name={iconStart} size={14} />
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            value={value}
            className={cn(
              "w-full box-border bg-[oklch(0.13_0_0)] border rounded-md px-3 py-2 text-fg-2 font-mono text-[13px] outline-none transition-colors duration-150",
              "border-[oklch(0.22_0_0)] focus:border-amber",
              error && "border-hot-border focus:border-hot",
              iconStart && "pl-8",
              onClear && "pr-8",
              className
            )}
            {...props}
          />
          {onClear && value ? (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-4 hover:text-fg-2 p-1 flex cursor-pointer"
            >
              <Icon name="x" size={12} />
            </button>
          ) : null}
        </div>
        {hint && !error && (
          <p className="mt-1.5 font-mono text-[11px] text-fg-4">{hint}</p>
        )}
        {error && (
          <p className="mt-1.5 font-mono text-[11px] text-hot">{error}</p>
        )}
      </div>
    );
  }
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, id, rows = 4, className, ...props }, ref) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    return (
      <div className="flex flex-col">
        {label && <Label htmlFor={inputId}>{label}</Label>}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(
            "w-full box-border bg-[oklch(0.13_0_0)] border border-[oklch(0.22_0_0)] focus:border-amber rounded-md px-3 py-2.5 text-fg-2 font-mono text-[12px] outline-none resize-none leading-[1.55] transition-colors duration-150",
            className
          )}
          {...props}
        />
        {hint && <p className="mt-1.5 font-mono text-[11px] text-fg-4">{hint}</p>}
      </div>
    );
  }
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, id, className, children, ...props }, ref) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    return (
      <div className="flex flex-col">
        {label && <Label htmlFor={inputId}>{label}</Label>}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              "w-full appearance-none bg-[oklch(0.13_0_0)] border border-[oklch(0.22_0_0)] focus:border-amber rounded-md pl-3 pr-7 py-2 text-fg-2 font-mono text-[13px] outline-none cursor-pointer transition-colors duration-150",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-4 pointer-events-none flex">
            <Icon name="chevronDown" size={12} />
          </span>
        </div>
      </div>
    );
  }
);

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 bg-transparent border-0 cursor-pointer p-0"
    >
      <span
        className={cn(
          "relative w-7 h-4 rounded-full border transition-colors duration-150",
          checked ? "bg-amber border-amber" : "bg-[oklch(0.20_0_0)] border-[oklch(0.25_0_0)]"
        )}
      >
        <span
          className={cn(
            "absolute top-px w-3 h-3 rounded-full transition-[left] duration-150",
            checked ? "left-[13px] bg-canvas" : "left-px bg-[oklch(0.55_0_0)]"
          )}
        />
      </span>
      {label && <span className="font-mono text-[13px] text-fg-2">{label}</span>}
    </button>
  );
}
