"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export function Dialog({
  open,
  onClose,
  title,
  dotColor = "var(--amber)",
  children,
  footer,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  dotColor?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 ds-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-sidebar border border-border rounded-xl ds-scale-up flex flex-col max-h-[90dvh]"
        style={{ maxWidth: `${width}px` }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-1.5 h-1.5 rounded-full ds-pulse shrink-0"
              style={{ background: dotColor }}
            />
            <span className="font-mono text-[13px] text-fg-1 font-medium truncate">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-transparent border-0 text-fg-4 hover:text-fg-2 cursor-pointer p-1 flex shrink-0"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
