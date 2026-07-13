"use client";

import * as React from "react";
import { Toast, type ToastProps } from "@/components/ui/toast";

type ToastKind = NonNullable<ToastProps["kind"]>;

export type ToastInput = {
  kind?: ToastKind;
  message: string;
  pill?: string;
  /** Optional action button (e.g. Undo). Toast dismisses after onAction runs. */
  action?: { label: string; onAction: () => void | Promise<void> };
  /** ms before auto-dismiss. Defaults to 4000 (5000 when an action is present). */
  duration?: number;
};

type QueuedToast = ToastInput & { id: number; leaving: boolean };

type ToasterContextValue = {
  toast: (t: ToastInput) => void;
};

const ToasterContext = React.createContext<ToasterContextValue | null>(null);

export function useToast(): ToasterContextValue {
  const ctx = React.useContext(ToasterContext);
  if (!ctx) throw new Error("useToast must be used within <Toaster>");
  return ctx;
}

const EXIT_MS = 150;

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<QueuedToast[]>([]);
  const nextId = React.useRef(1);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    // Two-phase removal so the exit animation can play.
    setToasts((prev) => prev.map((q) => (q.id === id ? { ...q, leaving: true } : q)));
    setTimeout(() => setToasts((prev) => prev.filter((q) => q.id !== id)), EXIT_MS);
  }, []);

  const toast = React.useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const duration = input.duration ?? (input.action ? 5000 : 4000);
      setToasts((prev) => [...prev.slice(-3), { ...input, id, leaving: false }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 max-w-[min(92vw,420px)] pb-14 lg:pb-0"
      >
        {toasts.map((q) => (
          <Toast
            key={q.id}
            kind={q.kind ?? "success"}
            pill={q.pill}
            className={`shadow-lg cursor-default pointer-events-auto ${
              q.leaving
                ? "animate-out fade-out slide-out-to-bottom-2 duration-150"
                : "animate-in fade-in slide-in-from-bottom-2 duration-200"
            }`}
            onClick={() => dismiss(q.id)}
          >
            <span className="min-w-0">{q.message}</span>
            {q.action && (
              <button
                type="button"
                className="font-mono text-[11px] uppercase tracking-[0.08em] underline underline-offset-2 hover:opacity-80 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  void q.action!.onAction();
                  dismiss(q.id);
                }}
              >
                {q.action.label}
              </button>
            )}
          </Toast>
        ))}
      </div>
    </ToasterContext.Provider>
  );
}
