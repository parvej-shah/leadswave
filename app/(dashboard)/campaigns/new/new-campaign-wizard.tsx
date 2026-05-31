"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Toast, CategoryBadge, Icon } from "@/components/ui";
import { MapsLead } from "@/agents/scout/maps-graph";

type SuggestedCity = { city: string; reason: string; score: number };

type Phase = "details" | "cities" | "running" | "review" | "done";

const STEPS = [
  { key: "details", label: "Details" },
  { key: "cities", label: "Cities" },
  { key: "review", label: "Review Leads" },
] as const;

// Each phase: [label, targetPercent, durationMs]
const RUNNING_PHASES: [string, number, number][] = [
  ["Searching Google Maps…",  28, 14000],
  ["Enriching lead data…",    62, 18000],
  ["Filtering duplicates…",   88,  8000],
  ["Almost done…",            98, 20000],
];

function RunningIndicator() {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [pct, setPct] = useState(0);
  // spinning orbit angle, always animates
  const [angle, setAngle] = useState(0);

  // perpetual spin — 360° per 1.2s
  useEffect(() => {
    let raf: number;
    let prev = performance.now();
    function loop(now: number) {
      const dt = now - prev;
      prev = now;
      setAngle((a) => (a + dt * 0.3) % 360);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // progress ticks per phase
  useEffect(() => {
    let current = pct;
    let frame: ReturnType<typeof setTimeout>;
    function tick() {
      const [, target, duration] = RUNNING_PHASES[phaseIdx];
      const remaining = target - current;
      const step = remaining / (duration / 80);
      current = Math.min(current + step, target);
      setPct(Math.round(current));
      if (current < target) frame = setTimeout(tick, 80);
    }
    tick();
    return () => clearTimeout(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx]);

  useEffect(() => {
    if (phaseIdx >= RUNNING_PHASES.length - 1) return;
    const [, , duration] = RUNNING_PHASES[phaseIdx];
    const t = setTimeout(() => setPhaseIdx((i) => Math.min(i + 1, RUNNING_PHASES.length - 1)), duration);
    return () => clearTimeout(t);
  }, [phaseIdx]);

  const label = RUNNING_PHASES[phaseIdx][0];
  const r = 34;
  const circumference = 2 * Math.PI * r;
  // orbit dot position
  const rad = (angle * Math.PI) / 180;
  const dotX = 40 + r * Math.cos(rad);
  const dotY = 40 + r * Math.sin(rad);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-8 px-8">
      {/* Circular arc + orbiting dot + percentage */}
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          {/* track */}
          <circle cx="40" cy="40" r={r} fill="none" stroke="oklch(0.18 0 0)" strokeWidth="4" />
          {/* progress arc */}
          <circle
            cx="40" cy="40" r={r}
            fill="none"
            stroke="var(--amber)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 0.12s linear" }}
            opacity="0.35"
          />
          {/* orbiting dot — always spins */}
          <circle cx={dotX} cy={dotY} r="3.5" fill="var(--amber)" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[16px] font-semibold text-amber tabular-nums leading-none">
            {pct}%
          </span>
        </div>
      </div>

      {/* Label + sub */}
      <div className="text-center">
        <p className="font-mono text-[13px] text-fg-2 m-0">{label}</p>
        <p className="font-mono text-[11px] text-fg-5 m-0 mt-1.5">this can take up to a minute</p>
      </div>

      {/* Linear progress bar */}
      <div className="w-full max-w-64 h-[3px] rounded-full bg-[oklch(0.18_0_0)] overflow-hidden">
        <div
          className="h-full rounded-full bg-amber"
          style={{ width: `${pct}%`, transition: "width 0.12s linear" }}
        />
      </div>

      {/* Phase dots */}
      <div className="flex items-center gap-2">
        {RUNNING_PHASES.map((_, i) => (
          <div
            key={i}
            className={[
              "rounded-full transition-all duration-300",
              i < phaseIdx ? "w-1.5 h-1.5 bg-amber" : i === phaseIdx ? "w-2 h-2 bg-amber" : "w-1.5 h-1.5 bg-[oklch(0.22_0_0)]",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

function StepIndicator({ phase }: { phase: Phase }) {
  const activeIdx = phase === "details" ? 0 : phase === "cities" ? 1 : 2;
  return (
    <div className="flex items-center gap-0 mb-4">
      {STEPS.map((step, i) => {
        const done = i < activeIdx || phase === "done";
        const active = i === activeIdx && phase !== "running" && phase !== "done";
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={[
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-semibold shrink-0 transition-colors duration-200",
                  done
                    ? "bg-amber text-canvas"
                    : active
                    ? "border border-amber text-amber"
                    : "border border-[oklch(0.22_0_0)] text-fg-5",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={[
                  "font-mono text-[11px] transition-colors duration-200",
                  done ? "text-amber" : active ? "text-fg-2" : "text-fg-5",
                ].join(" ")}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={[
                  "w-8 h-px mx-3 transition-colors duration-200",
                  i < activeIdx ? "bg-amber" : "bg-[oklch(0.22_0_0)]",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="mt-1.5 h-1 w-full rounded-full bg-[oklch(0.18_0_0)] overflow-hidden">
      <div
        className="h-full rounded-full bg-amber transition-all duration-500"
        style={{ width: `${Math.min(score, 100)}%` }}
      />
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
      {/* Checkbox */}
      <div
        className={[
          "mt-0.5 w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 text-[9px]",
          checked ? "bg-amber border-amber text-canvas" : "border-[oklch(0.28_0_0)]",
        ].join(" ")}
      >
        {checked ? "✓" : ""}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[13px] text-fg-1 font-medium truncate">{lead.companyName}</span>
          <CategoryBadge category={lead.category} size="sm" />
          {lead.rating != null && (
            <span
              className={[
                "font-mono text-[11px]",
                lead.rating >= 4 ? "text-amber" : "text-fg-4",
              ].join(" ")}
            >
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

export function NewCampaignWizard() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("details");
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [country, setCountry] = useState("");
  const [websiteOffer, setWebsiteOffer] = useState("");
  const [crmOffer, setCrmOffer] = useState("");

  const [cities, setCities] = useState<SuggestedCity[]>([]);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [leads, setLeads] = useState<MapsLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());

  const [error, setError] = useState("");
  const [loadingCities, setLoadingCities] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [generatingOffer, setGeneratingOffer] = useState<"website" | "crm" | null>(null);

  const allLeadsSelected = leads.length > 0 && selectedLeads.size === leads.length;

  function toggleCity(city: string) {
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  function toggleLead(idx: number) {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleAllLeads() {
    if (allLeadsSelected) setSelectedLeads(new Set());
    else setSelectedLeads(new Set(leads.map((_, i) => i)));
  }

  async function generateOffer(type: "website" | "crm") {
    if (!businessType.trim() && !name.trim()) return;
    setGeneratingOffer(type);
    try {
      const res = await fetch("/api/campaigns/description-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: [name, businessType, country].filter(Boolean).join(", "),
          campaignName: name,
          query: businessType,
          location: country,
          offerType: type,
        }),
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        if (type === "website") setWebsiteOffer(data.draft);
        else setCrmOffer(data.draft);
      }
    } finally {
      setGeneratingOffer(null);
    }
  }

  async function findCities() {
    setError("");
    if (!name.trim() || !businessType.trim() || !country.trim()) {
      setError("Name, business type, and country are required.");
      return;
    }
    setLoadingCities(true);
    try {
      const res = await fetch("/api/campaigns/suggest-cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, country }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to suggest cities"); return; }
      setCities(data.cities ?? []);
      setSelectedCities(new Set());
      setPhase("cities");
    } catch {
      setError("Failed to suggest cities");
    } finally {
      setLoadingCities(false);
    }
  }

  const runPreview = useCallback(async (id: string) => {
    const res = await fetch("/api/agents/scout/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Lead scouting failed");
    return (data.leads ?? []) as MapsLead[];
  }, []);

  async function launch() {
    setError("");
    const cities = Array.from(selectedCities);
    if (cities.length === 0) { setError("Pick at least one city."); return; }

    setPhase("running");

    try {
      // Create campaign
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, businessType, country, selectedCities: cities, websiteOffer, crmOffer }),
      });
      if (!createRes.ok) {
        const data = await createRes.json();
        setError(data.error ?? "Failed to create campaign");
        setPhase("cities");
        return;
      }
      const campaign = await createRes.json();
      setCampaignId(campaign.id);

      // Run preview (no save)
      const previewLeads = await runPreview(campaign.id);
      setLeads(previewLeads);
      setSelectedLeads(new Set(previewLeads.map((_, i) => i)));
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lead scouting failed");
      setPhase("cities");
    }
  }

  async function rerun() {
    if (!campaignId) return;
    setError("");
    setRerunning(true);
    try {
      const previewLeads = await runPreview(campaignId);
      setLeads(previewLeads);
      setSelectedLeads(new Set(previewLeads.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-run failed");
    } finally {
      setRerunning(false);
    }
  }

  async function saveSelected() {
    if (!campaignId) return;
    setError("");
    const chosen = leads.filter((_, i) => selectedLeads.has(i));

    const res = await fetch("/api/agents/scout/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, leads: chosen }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save leads");
      return;
    }
    setPhase("done");
    setTimeout(() => router.push("/campaigns"), 1800);
  }

  if (phase === "done") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-amber-bg border border-amber-border flex items-center justify-center mx-auto mb-4">
            <span className="text-amber text-xl">✓</span>
          </div>
          <p className="font-sans text-[28px] font-semibold tracking-[-0.02em] text-amber m-0 mb-1 tabular-nums">
            {selectedLeads.size}
          </p>
          <p className="font-mono text-[13px] text-fg-3 m-0">leads saved to campaign</p>
          <p className="font-mono text-[11px] text-fg-5 m-0 mt-4">redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-220 mx-auto px-4 py-4">
      {/* Back link */}
      <Link
        href="/campaigns"
        className="font-mono text-[11px] text-fg-4 hover:text-fg-2 inline-flex items-center gap-1.5 mb-3 transition-colors duration-150"
      >
        ← Campaigns
      </Link>

      {/* Header */}
      <div className="mb-3">
        <h1 className="ds-h1 m-0 mb-0.5">New Campaign</h1>
        <p className="font-mono text-[12px] text-fg-4 m-0">
          {phase === "cities"
            ? "Pick the cities to gather leads from."
            : phase === "review"
            ? "Review and select the leads to save."
            : "Define your campaign — AI will rank the best cities."}
        </p>
      </div>

      {/* Step indicator */}
      {phase !== "running" && <StepIndicator phase={phase} />}

      {/* ── DETAILS ── */}
      {phase === "details" && (
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
          <Input
            label="Campaign Name"
            placeholder="e.g. BD dentists Q2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Business Type"
              placeholder='e.g. "dentists"'
              hint="What kind of business?"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            />
            <Input
              label="Country"
              placeholder='e.g. "Bangladesh"'
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
          <div className="border-t border-border pt-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] text-fg-5 m-0 uppercase tracking-wider">Offer Templates (optional)</p>
              <p className="font-mono text-[10px] text-fg-5 m-0">AI will draft based on your campaign details</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-4">Website-proposal offer</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconStart="sparkle"
                    disabled={generatingOffer === "website" || (!name.trim() && !businessType.trim())}
                    onClick={() => generateOffer("website")}
                  >
                    {generatingOffer === "website" ? "Generating…" : "AI Generate"}
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Pitch for leads with no website — sell a website build."
                  value={websiteOffer}
                  onChange={(e) => setWebsiteOffer(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-4">CRM offer</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconStart="sparkle"
                    disabled={generatingOffer === "crm" || (!name.trim() && !businessType.trim())}
                    onClick={() => generateOffer("crm")}
                  >
                    {generatingOffer === "crm" ? "Generating…" : "AI Generate"}
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Pitch for leads that already have a website — sell CRM."
                  value={crmOffer}
                  onChange={(e) => setCrmOffer(e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && <Toast kind="hot" pill="ERROR">{error}</Toast>}

          <div className="flex justify-between items-center pt-0.5">
            <Link href="/campaigns">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button
              type="button"
              size="lg"
              onClick={findCities}
              disabled={loadingCities}
              iconStart={loadingCities ? "refresh" : "sparkle"}
            >
              {loadingCities ? "finding cities…" : "Find Cities"}
            </Button>
          </div>
        </div>
      )}

      {/* ── CITIES ── */}
      {phase === "cities" && (
        <div className="flex flex-col gap-4">
          {/* Quick actions */}
          <div className="flex items-center justify-between">
            <p className="font-mono text-[12px] text-fg-3 m-0">
              Top cities for <span className="text-fg-1">{businessType}</span> in <span className="text-fg-1">{country}</span>
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCities(new Set(cities.map((c) => c.city)))}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCities(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {cities.map((c) => {
              const active = selectedCities.has(c.city);
              return (
                <button
                  key={c.city}
                  type="button"
                  onClick={() => toggleCity(c.city)}
                  className={[
                    "text-left rounded-lg border px-4 py-3 transition-colors duration-150 cursor-pointer w-full",
                    active
                      ? "bg-amber-bg border-amber-border"
                      : "bg-[oklch(0.12_0_0)] border-[oklch(0.19_0_0)] hover:border-[oklch(0.26_0_0)]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        "w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 text-[9px]",
                        active ? "bg-amber border-amber text-canvas" : "border-[oklch(0.28_0_0)]",
                      ].join(" ")}
                    >
                      {active ? "✓" : ""}
                    </span>
                    <span className="font-mono text-[13px] text-fg-1 font-medium flex-1">{c.city}</span>
                    <span className="font-mono text-[11px] text-fg-4 shrink-0">{c.score}/100</span>
                  </div>
                  <ScoreBar score={c.score} />
                  {c.reason && (
                    <p className="font-mono text-[11px] text-fg-4 mt-2 ml-7 m-0">{c.reason}</p>
                  )}
                </button>
              );
            })}
          </div>

          {error && <Toast kind="hot" pill="ERROR">{error}</Toast>}

          <div className="flex justify-between items-center mt-2">
            <Button type="button" variant="ghost" onClick={() => setPhase("details")}>
              ← Back
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={launch}
              iconStart="play"
              disabled={selectedCities.size === 0}
            >
              Scout Leads ({selectedCities.size} {selectedCities.size === 1 ? "city" : "cities"})
            </Button>
          </div>
        </div>
      )}

      {/* ── RUNNING ── */}
      {phase === "running" && (
        <div className="bg-surface border border-border rounded-xl">
          <RunningIndicator />
        </div>
      )}

      {/* ── REVIEW ── */}
      {phase === "review" && (
        <div className="flex flex-col gap-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[12px] text-fg-3 m-0">
                <span className="text-fg-1 font-medium">{leads.length}</span> leads found —{" "}
                <span className="text-amber">{selectedLeads.size}</span> selected
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleAllLeads}
              >
                {allLeadsSelected ? "Deselect all" : "Select all"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconStart="refresh"
                disabled={rerunning}
                onClick={rerun}
              >
                {rerunning ? "Scanning…" : "Re-run"}
              </Button>
            </div>
          </div>

          {leads.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl py-12 text-center">
              <p className="font-mono text-[13px] text-fg-4 m-0">No new leads found.</p>
              <p className="font-mono text-[11px] text-fg-5 m-0 mt-1.5">
                All results may already be saved or deduped.
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
                  checked={selectedLeads.has(i)}
                  onToggle={() => toggleLead(i)}
                />
              ))}
            </div>
          )}

          {error && <Toast kind="hot" pill="ERROR">{error}</Toast>}

          <div className="flex justify-between items-center mt-2">
            <Button type="button" variant="ghost" onClick={() => setPhase("cities")}>
              ← Back
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={saveSelected}
              disabled={selectedLeads.size === 0}
              iconStart="check"
            >
              Save Selected ({selectedLeads.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
