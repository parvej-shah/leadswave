"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Select, Textarea, Toast, CategoryBadge, Icon } from "@/components/ui";
import { OffersEditor, DEFAULT_OFFERS, type OfferDraft } from "@/components/offers-editor";
import { MapsLead } from "@/agents/scout/maps-graph";

type SuggestedCity = { city: string; reason: string; score: number };
type SuggestedArea = { area: string; reason: string; score: number };
type CityAreas = { city: string; areas: SuggestedArea[] };

type Phase = "details" | "cities" | "areas" | "running" | "review" | "done";

const STEPS = [
  { key: "details", label: "Details" },
  { key: "cities", label: "Cities" },
  { key: "areas", label: "Areas" },
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
  const activeIdx = phase === "details" ? 0 : phase === "cities" ? 1 : phase === "areas" ? 2 : 3;
  return (
    <div className="flex items-center gap-0 mb-4 overflow-x-auto">
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
        "flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors duration-150 animate-in fade-in slide-in-from-bottom-1",
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
  const [knownTypes, setKnownTypes] = useState<string[]>([]);
  const [country, setCountry] = useState("");

  useEffect(() => {
    fetch("/api/business-types")
      .then((r) => (r.ok ? r.json() : []))
      .then((types: { name: string }[]) => setKnownTypes(types.map((t) => t.name)))
      .catch(() => {});
  }, []);
  const [offers, setOffers] = useState<OfferDraft[]>(DEFAULT_OFFERS);
  const [scoutDepth, setScoutDepth] = useState("normal");

  const [cities, setCities] = useState<SuggestedCity[]>([]);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());

  const [areasByCity, setAreasByCity] = useState<CityAreas[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<Record<string, Set<string>>>({});
  const [loadingAreas, setLoadingAreas] = useState(false);

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [leads, setLeads] = useState<MapsLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());

  const [error, setError] = useState("");
  const [loadingCities, setLoadingCities] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [liveNote, setLiveNote] = useState("");
  const [generatingOffer, setGeneratingOffer] = useState<number | null>(null);

  const allLeadsSelected = leads.length > 0 && selectedLeads.size === leads.length;

  function toggleCity(city: string) {
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  function toggleArea(city: string, area: string) {
    setSelectedAreas((prev) => {
      const next = { ...prev };
      const set = new Set(next[city] ?? []);
      if (set.has(area)) set.delete(area);
      else set.add(area);
      next[city] = set;
      return next;
    });
  }

  function setAllAreas(selected: boolean) {
    setSelectedAreas(
      Object.fromEntries(
        areasByCity.map((c) => [c.city, new Set(selected ? c.areas.map((a) => a.area) : [])])
      )
    );
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

  async function generateOffer(index: number) {
    const offer = offers[index];
    if (!offer || (!businessType.trim() && !name.trim())) return;
    setGeneratingOffer(index);
    try {
      const res = await fetch("/api/campaigns/description-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: [name, businessType, country, offer.label].filter(Boolean).join(", "),
          campaignName: name,
          query: businessType,
          location: country,
          offerLabel: offer.label,
          matchSignal: offer.matchSignal,
        }),
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setOffers((prev) => prev.map((o, i) => (i === index ? { ...o, offerText: data.draft } : o)));
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

  async function findAreas() {
    setError("");
    if (selectedCities.size === 0) { setError("Pick at least one city."); return; }
    setLoadingAreas(true);
    try {
      const res = await fetch("/api/campaigns/suggest-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, country, cities: Array.from(selectedCities) }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Don't dead-end: show the areas step with no suggestions — user can scout city-wide
        setAreasByCity([]);
        setSelectedAreas({});
        setError(data.error ?? "Failed to suggest areas — you can scout city-wide instead.");
        setPhase("areas");
        return;
      }
      const byCity = (data.areas ?? []) as CityAreas[];
      setAreasByCity(byCity);
      // Default: all suggested areas selected
      setSelectedAreas(Object.fromEntries(byCity.map((c) => [c.city, new Set(c.areas.map((a) => a.area))])));
      setPhase("areas");
    } catch {
      setAreasByCity([]);
      setSelectedAreas({});
      setError("Failed to suggest areas — you can scout city-wide instead.");
      setPhase("areas");
    } finally {
      setLoadingAreas(false);
    }
  }

  const runPreview = useCallback(async (id: string) => {
    // Streaming path: real node-by-node progress + leads the moment the
    // pipeline finishes deduping (SSE over fetch — EventSource can't POST).
    try {
      const res = await fetch("/api/agents/scout/preview/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id }),
      });
      if (!res.ok || !res.body) throw new Error("stream unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamed: MapsLead[] | null = null;
      let streamError = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "progress") {
              setLiveNote(evt.count != null ? `${evt.label} (${evt.count})` : evt.label);
            } else if (evt.type === "leads") {
              streamed = evt.leads as MapsLead[];
              setLiveNote(`Found ${streamed.length} leads — finishing up…`);
            } else if (evt.type === "error") {
              streamError = evt.error;
            }
          } catch {
            // malformed frame — ignore
          }
        }
      }
      if (streamError) throw new Error(streamError);
      if (streamed) return streamed;
      throw new Error("stream ended without leads");
    } catch (err) {
      // Graceful fallback to the non-streaming endpoint
      console.warn("[wizard] stream preview failed, falling back:", err);
      setLiveNote("");
      const res = await fetch("/api/agents/scout/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lead scouting failed");
      return (data.leads ?? []) as MapsLead[];
    }
  }, []);

  async function launch() {
    setError("");
    const cities = Array.from(selectedCities);
    if (cities.length === 0) { setError("Pick at least one city."); return; }

    setPhase("running");

    // Convert selected area sets → { city: string[] }, dropping cities with nothing picked
    const areasPayload = Object.fromEntries(
      Object.entries(selectedAreas)
        .map(([city, set]) => [city, Array.from(set)] as const)
        .filter(([city, list]) => list.length > 0 && cities.includes(city))
    );

    try {
      // Create campaign
      const createRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, businessType, country, scoutDepth, selectedCities: cities, selectedAreas: areasPayload, offers: offers.filter((o) => o.label.trim() && o.offerText.trim()) }),
      });
      if (!createRes.ok) {
        const data = await createRes.json();
        setError(data.error ?? "Failed to create campaign");
        setPhase("areas");
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
      setPhase("areas");
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
            : phase === "areas"
            ? "Pick hotspot areas per city — cities with no areas selected are searched city-wide."
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Business Type"
              placeholder='e.g. "dentists"'
              hint="What kind of business?"
              list="known-business-types"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            />
            <datalist id="known-business-types">
              {knownTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <Input
              label="Country"
              placeholder='e.g. "Bangladesh"'
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
            <Select
              label="Scouting depth"
              value={scoutDepth}
              onChange={(e) => setScoutDepth(e.target.value)}
            >
              <option value="light">Light — quick sample, lowest API cost</option>
              <option value="normal">Normal — balanced (recommended)</option>
              <option value="deep">Deep — maximum coverage</option>
            </Select>
          </div>
          <div className="border-t border-border pt-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] text-fg-5 m-0 uppercase tracking-wider">Offers (optional)</p>
              <p className="font-mono text-[10px] text-fg-5 m-0">AI will draft based on your campaign details</p>
            </div>
            <OffersEditor
              offers={offers}
              onChange={setOffers}
              onGenerate={generateOffer}
              generatingIndex={generatingOffer}
              generateDisabled={!name.trim() && !businessType.trim()}
            />
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
              onClick={findAreas}
              iconStart={loadingAreas ? "refresh" : "sparkle"}
              disabled={selectedCities.size === 0 || loadingAreas}
            >
              {loadingAreas
                ? "finding areas…"
                : `Find Hotspot Areas (${selectedCities.size} ${selectedCities.size === 1 ? "city" : "cities"})`}
            </Button>
          </div>
        </div>
      )}

      {/* ── AREAS ── */}
      {phase === "areas" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[12px] text-fg-3 m-0">
              Hotspot areas for <span className="text-fg-1">{businessType}</span>
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAllAreas(true)}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAllAreas(false)}>
                Clear
              </Button>
            </div>
          </div>

          {areasByCity.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl py-12 text-center">
              <p className="font-mono text-[13px] text-fg-4 m-0">No area suggestions available.</p>
              <p className="font-mono text-[11px] text-fg-5 m-0 mt-1.5">
                You can still scout each city city-wide.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {areasByCity.map((cityGroup) => {
                const citySelected = selectedAreas[cityGroup.city] ?? new Set<string>();
                return (
                  <div key={cityGroup.city} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-fg-4 m-0">
                        {cityGroup.city}
                        <span className="text-fg-5 ml-2 normal-case tracking-normal">
                          {citySelected.size}/{cityGroup.areas.length} selected
                        </span>
                      </p>
                      <button
                        type="button"
                        className="font-mono text-[11px] text-fg-4 hover:text-fg-2 transition-colors cursor-pointer"
                        onClick={() =>
                          setSelectedAreas((prev) => ({
                            ...prev,
                            [cityGroup.city]:
                              citySelected.size === cityGroup.areas.length
                                ? new Set<string>()
                                : new Set(cityGroup.areas.map((a) => a.area)),
                          }))
                        }
                      >
                        {citySelected.size === cityGroup.areas.length ? "Clear" : "Select all"}
                      </button>
                    </div>
                    {cityGroup.areas.map((a) => {
                      const active = citySelected.has(a.area);
                      return (
                        <button
                          key={a.area}
                          type="button"
                          onClick={() => toggleArea(cityGroup.city, a.area)}
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
                            <span className="font-mono text-[13px] text-fg-1 font-medium flex-1">{a.area}</span>
                            <span className="font-mono text-[11px] text-fg-4 shrink-0">{a.score}/100</span>
                          </div>
                          <ScoreBar score={a.score} />
                          {a.reason && (
                            <p className="font-mono text-[11px] text-fg-4 mt-2 ml-7 m-0">{a.reason}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {error && <Toast kind="hot" pill="ERROR">{error}</Toast>}

          <div className="flex justify-between items-center mt-2">
            <Button type="button" variant="ghost" onClick={() => setPhase("cities")}>
              ← Back
            </Button>
            <Button type="button" size="lg" onClick={launch} iconStart="play">
              {(() => {
                const n = Object.values(selectedAreas).reduce((sum, s) => sum + s.size, 0);
                return n > 0 ? `Scout Leads (${n} ${n === 1 ? "area" : "areas"})` : "Scout Leads (city-wide)";
              })()}
            </Button>
          </div>
        </div>
      )}

      {/* ── RUNNING ── */}
      {phase === "running" && (
        <div className="bg-surface border border-border rounded-xl">
          <RunningIndicator />
          {liveNote && (
            <p className="font-mono text-[11px] text-fg-4 text-center m-0 pb-5 -mt-3">
              {liveNote}
            </p>
          )}
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
            <Button type="button" variant="ghost" onClick={() => setPhase("areas")}>
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
