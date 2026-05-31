"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Toast, CategoryBadge, Icon } from "@/components/ui";
import { MapsLead } from "@/agents/scout/maps-graph";

const RUNNING_MESSAGES = [
  "Searching Google Maps…",
  "Enriching lead data…",
  "Filtering duplicates…",
  "Almost done…",
];

function RunningIndicator() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [dot, setDot] = useState(0);

  useEffect(() => {
    const msgTimer = setInterval(() => setMsgIdx((i) => Math.min(i + 1, RUNNING_MESSAGES.length - 1)), 15000);
    const dotTimer = setInterval(() => setDot((d) => (d + 1) % 4), 500);
    return () => { clearInterval(msgTimer); clearInterval(dotTimer); };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-amber transition-opacity duration-300"
            style={{ opacity: dot === i ? 1 : 0.2 }}
          />
        ))}
      </div>
      <div className="text-center">
        <p className="font-mono text-[13px] text-fg-2 m-0">{RUNNING_MESSAGES[msgIdx]}</p>
        <p className="font-mono text-[11px] text-fg-5 m-0 mt-1.5">this can take up to a minute</p>
      </div>
    </div>
  );
}

type LeadRowProps = {
  lead: MapsLead;
  checked: boolean;
  onToggle: () => void;
};

function LeadRow({ lead, checked, onToggle }: LeadRowProps) {
  const domain = lead.website
    ? lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0]
    : null;

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors duration-150",
        checked
          ? "bg-amber-bg border-amber-border"
          : "bg-[oklch(0.12_0_0)] border-[oklch(0.19_0_0)] hover:border-[oklch(0.26_0_0)]",
      ].join(" ")}
      onClick={onToggle}
    >
      <div
        className={[
          "mt-0.5 w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 text-[9px]",
          checked ? "bg-amber border-amber text-canvas" : "border-[oklch(0.28_0_0)]",
        ].join(" ")}
      >
        {checked ? "✓" : ""}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[13px] text-fg-1 font-medium truncate">{lead.companyName}</span>
          <CategoryBadge category={lead.category} size="sm" />
          {lead.rating != null && (
            <span className={["font-mono text-[11px]", lead.rating >= 4 ? "text-amber" : "text-fg-4"].join(" ")}>
              ★ {lead.rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {lead.address && (
            <span className="font-mono text-[11px] text-fg-4 truncate max-w-50">{lead.address}</span>
          )}
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[11px] text-fg-3 hover:text-fg-1 transition-colors"
            >
              {lead.phone}
            </a>
          )}
          {domain && (
            <a
              href={lead.website!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[11px] text-info hover:text-fg-1 transition-colors flex items-center gap-1"
            >
              {domain}
              <Icon name="arrow" size={10} />
            </a>
          )}
          {lead.email && (
            <span className="font-mono text-[11px] text-fg-4 truncate max-w-45">{lead.email}</span>
          )}
        </div>
      </div>
    </div>
  );
}

type ViewPhase = "loading" | "review" | "done" | "error";

export default function CampaignScoutPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [phase, setPhase] = useState<ViewPhase>("loading");
  const [leads, setLeads] = useState<MapsLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [rerunning, setRerunning] = useState(false);

  const allSelected = leads.length > 0 && selected.size === leads.length;

  const runPreview = useCallback(async () => {
    const res = await fetch("/api/agents/scout/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Scouting failed");
    return (data.leads ?? []) as MapsLead[];
  }, [campaignId]);

  useEffect(() => {
    runPreview()
      .then((l) => {
        setLeads(l);
        setSelected(new Set(l.map((_, i) => i)));
        setPhase("review");
      })
      .catch((err) => {
        setError(err.message);
        setPhase("error");
      });
  }, [runPreview]);

  function toggleLead(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function rerun() {
    setRerunning(true);
    setError("");
    try {
      const l = await runPreview();
      setLeads(l);
      setSelected(new Set(l.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-run failed");
    } finally {
      setRerunning(false);
    }
  }

  async function saveSelected() {
    const chosen = leads.filter((_, i) => selected.has(i));
    const res = await fetch("/api/agents/scout/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, leads: chosen }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Save failed");
      return;
    }
    setPhase("done");
    setTimeout(() => router.push("/campaigns"), 1800);
  }

  return (
    <div className="max-w-170 mx-auto px-4 py-8">
      <Link
        href="/campaigns"
        className="font-mono text-[11px] text-fg-4 hover:text-fg-2 inline-flex items-center gap-1.5 mb-6 transition-colors duration-150"
      >
        ← Campaigns
      </Link>

      <div className="mb-6">
        <h1 className="ds-h1 m-0 mb-1">Scout New Leads</h1>
        <p className="font-mono text-[12px] text-fg-4 m-0">
          {phase === "loading"
            ? "Running the scout agent…"
            : phase === "review"
            ? "Review and select leads to add. Already-saved leads are excluded."
            : phase === "done"
            ? "Leads saved."
            : "Something went wrong."}
        </p>
      </div>

      {phase === "loading" && (
        <div className="bg-surface border border-border rounded-xl">
          <RunningIndicator />
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-4">
          <Toast kind="hot" pill="ERROR">{error}</Toast>
          <Button type="button" variant="ghost" onClick={() => router.push("/campaigns")}>
            ← Back to campaigns
          </Button>
        </div>
      )}

      {phase === "done" && (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-amber-bg border border-amber-border flex items-center justify-center mx-auto mb-4">
              <span className="text-amber text-xl">✓</span>
            </div>
            <p className="font-sans text-[28px] font-semibold tracking-[-0.02em] text-amber m-0 mb-1 tabular-nums">
              {selected.size}
            </p>
            <p className="font-mono text-[13px] text-fg-3 m-0">leads saved</p>
            <p className="font-mono text-[11px] text-fg-5 m-0 mt-4">redirecting…</p>
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[12px] text-fg-3 m-0">
              <span className="text-fg-1 font-medium">{leads.length}</span> leads found —{" "}
              <span className="text-amber">{selected.size}</span> selected
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => allSelected ? setSelected(new Set()) : setSelected(new Set(leads.map((_, i) => i)))}>
                {allSelected ? "Deselect all" : "Select all"}
              </Button>
              <Button type="button" variant="ghost" size="sm" iconStart="refresh" disabled={rerunning} onClick={rerun}>
                {rerunning ? "Scanning…" : "Re-run"}
              </Button>
            </div>
          </div>

          {leads.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl py-12 text-center">
              <p className="font-mono text-[13px] text-fg-4 m-0">No new leads found.</p>
              <p className="font-mono text-[11px] text-fg-5 m-0 mt-1.5">
                All results are already saved or were filtered as duplicates.
              </p>
              <div className="mt-4">
                <Button type="button" variant="ghost" size="sm" iconStart="refresh" onClick={rerun} disabled={rerunning}>
                  {rerunning ? "Scanning…" : "Try again"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {leads.map((lead, i) => (
                <LeadRow
                  key={lead.placeId}
                  lead={lead}
                  checked={selected.has(i)}
                  onToggle={() => toggleLead(i)}
                />
              ))}
            </div>
          )}

          {error && <Toast kind="hot" pill="ERROR">{error}</Toast>}

          <div className="flex justify-between items-center mt-2">
            <Button type="button" variant="ghost" onClick={() => router.push("/campaigns")}>
              ← Back
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={saveSelected}
              disabled={selected.size === 0}
              iconStart="check"
            >
              Save Selected ({selected.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
