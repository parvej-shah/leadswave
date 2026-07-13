"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardHeader, EmptyState, SkeletonRows, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toaster";
import { LIVE_REFRESH_EVENT } from "./live-refresher";

type QueueJob = {
  id: string;
  type: string;
  scheduledAt: string;
  hasOverride: boolean;
  overrideBody: string | null;
  lead: {
    id: string;
    companyName: string;
    email: string | null;
    campaign: { id: string; name: string };
  };
};

const STEP_LABEL: Record<string, string> = {
  followup_2: "Follow-up #2",
  followup_3: "Follow-up #3",
  followup_4: "Follow-up #4",
};

/**
 * The autopilot's outbox: every scheduled follow-up, previewable and
 * skippable/editable BEFORE it sends. Trust surface — the user always knows
 * what goes out next and can intervene.
 */
export function FollowupQueue() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) setJobs(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // Refetch on the dashboard's live-poll tick so the queue stays in sync
    // with the server-rendered cards.
    const onLive = () => refresh();
    window.addEventListener(LIVE_REFRESH_EVENT, onLive);
    return () => window.removeEventListener(LIVE_REFRESH_EVENT, onLive);
  }, []);

  async function openPreview(job: QueueJob) {
    if (openId === job.id) {
      setOpenId(null);
      return;
    }
    setOpenId(job.id);
    setEditing(false);
    setPreview("");
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/preview`);
      const data = await res.json();
      setPreview(res.ok ? data.body : `(${data.error ?? "preview failed"})`);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function patchJob(id: string, payload: Record<string, string>) {
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Request failed");
    }
  }

  async function handleSkip(job: QueueJob) {
    // Optimistic: drop the row immediately, restore on failure.
    const snapshot = jobs;
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    if (openId === job.id) setOpenId(null);
    setBusy(true);
    try {
      await patchJob(job.id, { action: "skip" });
      toast({
        kind: "success",
        pill: "SKIPPED",
        message: `Follow-up to ${job.lead.companyName} skipped.`,
        action: {
          label: "Undo",
          onAction: async () => {
            try {
              await patchJob(job.id, { action: "unskip" });
              setJobs((prev) =>
                prev.some((j) => j.id === job.id)
                  ? prev
                  : [...prev, job].sort(
                      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
                    ),
              );
            } catch (err) {
              toast({
                kind: "hot",
                pill: "ERROR",
                message: err instanceof Error ? err.message : "Could not restore follow-up.",
              });
            }
          },
        },
      });
    } catch (err) {
      setJobs(snapshot);
      toast({
        kind: "hot",
        pill: "ERROR",
        message: err instanceof Error ? err.message : "Skip failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "edit" | "reset", body?: string) {
    setBusy(true);
    try {
      await patchJob(id, body !== undefined ? { action, body } : { action });
      setOpenId(null);
      setEditing(false);
      await refresh();
    } catch (err) {
      toast({
        kind: "hot",
        pill: "ERROR",
        message: err instanceof Error ? err.message : "Update failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        action={
          <span className="font-mono text-[10px] text-fg-4 tracking-[0.08em] uppercase">
            {jobs.length} scheduled
          </span>
        }
      >
        Scheduled Follow-ups
      </CardHeader>
      {loading ? (
        <SkeletonRows n={3} rowClassName="h-[52px]" />
      ) : jobs.length === 0 ? (
        <div className="p-5">
          <EmptyState>Nothing queued — follow-ups appear here before they send.</EmptyState>
        </div>
      ) : (
        <div className="flex flex-col max-h-[360px] overflow-y-auto">
          {jobs.map((job) => (
            <div key={job.id} className="border-b border-border-soft last:border-b-0 animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div className="flex items-center gap-3 px-5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[13px] text-fg-1 m-0 truncate">
                    <Link href={`/leads?highlight=${job.lead.id}`} className="hover:text-amber transition-colors">
                      {job.lead.companyName}
                    </Link>
                    {job.hasOverride && (
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-amber">edited</span>
                    )}
                  </p>
                  <p className="font-mono text-[10px] text-fg-5 m-0 mt-0.5">
                    {STEP_LABEL[job.type] ?? job.type} · {new Date(job.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {job.lead.campaign.name}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openPreview(job)}>
                  {openId === job.id ? "Close" : "Preview"}
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleSkip(job)}>
                  Skip
                </Button>
              </div>
              {openId === job.id && (
                <div className="px-5 pb-3 flex flex-col gap-2">
                  {previewLoading ? (
                    <p className="font-mono text-[12px] text-fg-4 m-0">Drafting preview…</p>
                  ) : editing ? (
                    <>
                      <Textarea rows={4} value={preview} onChange={(e) => setPreview(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" disabled={busy || !preview.trim()} onClick={() => act(job.id, "edit", preview)}>
                          Save — send this text
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-sans text-[13px] text-fg-3 m-0 whitespace-pre-wrap leading-[1.5] border border-border rounded-md p-3 bg-[oklch(0.12_0_0)]">
                        {preview}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
                        {job.hasOverride && (
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => act(job.id, "reset")}>
                            Reset to AI draft
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
