"use client";

import { useState } from "react";
import { Button, Toast } from "@/components/ui";

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

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="info"
        size="md"
        iconStart="refresh"
        disabled={state === "running"}
        onClick={run}
      >
        {state === "running" ? "processing…" : "Run follow-ups"}
      </Button>

      {state === "done" && result && (
        <Toast kind={result.failed > 0 ? "amber" : "success"} pill="DONE">
          {result.processed} sent
          {result.failed > 0 && ` · ${result.failed} failed`}
          {result.total === 0 && " · no jobs due"}
        </Toast>
      )}

      {state === "error" && (
        <Toast kind="hot" pill="ERROR">
          check console
        </Toast>
      )}
    </div>
  );
}
