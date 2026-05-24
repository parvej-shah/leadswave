"use client";

import { useState } from "react";

type Result = { processed: number; failed: number; total: number } | null;

export function RunFollowupsButton() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<Result>(null);

  async function run() {
    setState("running");
    setResult(null);
    try {
      const res = await fetch("/api/run-followups", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResult({ processed: data.processed, failed: data.failed, total: data.total });
      setState("done");
      setTimeout(() => setState("idle"), 6000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const mono = { fontFamily: "'DM Mono', monospace" } as const;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={state === "running"}
        style={{
          ...mono,
          background: state === "running" ? "oklch(0.18 0 0)" : "oklch(0.20 0.04 260)",
          color: state === "running" ? "oklch(0.45 0 0)" : "oklch(0.72 0.18 260)",
          border: `1px solid ${state === "running" ? "oklch(0.26 0 0)" : "oklch(0.32 0.10 260)"}`,
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          padding: "0.375rem 0.875rem",
          cursor: state === "running" ? "not-allowed" : "pointer",
          transition: "all 0.15s",
          letterSpacing: "0.03em",
        }}
      >
        {state === "running" ? "processing…" : "Run follow-ups"}
      </button>

      {state === "done" && result && (
        <span style={{ ...mono, fontSize: "0.72rem", color: "oklch(0.65 0.15 145)" }}>
          ✓ {result.processed} sent
          {result.failed > 0 && (
            <span style={{ color: "oklch(0.62 0.18 25)" }}> · {result.failed} failed</span>
          )}
          {result.total === 0 && " · no jobs due"}
        </span>
      )}

      {state === "error" && (
        <span style={{ ...mono, fontSize: "0.72rem", color: "oklch(0.62 0.18 25)" }}>
          ✗ error — check console
        </span>
      )}
    </div>
  );
}
