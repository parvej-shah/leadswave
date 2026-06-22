"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Toast, CategoryBadge, Icon } from "@/components/ui";
import { MapsLead } from "@/agents/scout/maps-graph";

type SuggestedCity = { city: string; reason: string; score: number };

const RUNNING_MESSAGES = [
  "Searching Google Maps…",
  "Filtering results…",
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

type ViewPhase = "loading-campaign" | "pick-cities" | "loading-cities" | "scouting" | "review" | "done" | "enriching" | "error";

export default function CampaignScoutPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [phase, setPhase] = useState<ViewPhase>("loading-campaign");
  const [campaign, setCampaign] = useState<{ businessType?: string; country?: string } | null>(null);

  // City picker state
  const [suggestedCities, setSuggestedCities] = useState<SuggestedCity[]>([]);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());

  // Lead review state
  const [leads, setLeads] = useState<MapsLead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [rerunning, setRerunning] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [enrichResult, setEnrichResult] = useState<{ emailsFound: number; total: number } | null>(null);

  // Selected cities to use when scouting (either from campaign or picker)
  const [citiesToScout, setCitiesToScout] = useState<string[] | null>(null);

  const allSelected = leads.length > 0 && selected.size === leads.length;

  // Load campaign and decide whether to go straight to scouting or show city picker
  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load campaign");
        setCampaign({ businessType: data.businessType, country: data.country });
        if (data.selectedCities?.length > 0) {
          // Campaign already has cities — go straight to scouting
          setCitiesToScout(null); // null means "use campaign's own cities"
          setPhase("scouting");
        } else {
          // No cities — need to pick some first
          setPhase("loading-cities");
          fetchCities(data.businessType ?? data.query ?? "", data.country ?? "");
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        setPhase("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function fetchCities(businessType: string, country: string) {
    try {
      const res = await fetch("/api/campaigns/suggest-cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, country }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to suggest cities");
      setSuggestedCities(data.cities ?? []);
      setSelectedCities(new Set((data.cities ?? []).map((c: SuggestedCity) => c.city)));
      setPhase("pick-cities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suggest cities");
      setPhase("error");
    }
  }

  function toggleCity(city: string) {
    setSelectedCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  const runPreview = useCallback(async (cities?: string[]) => {
    const body: Record<string, unknown> = { campaignId };
    if (cities) body.cities = cities;
    const res = await fetch("/api/agents/scout/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Scouting failed");
    return (data.leads ?? []) as MapsLead[];
  }, [campaignId]);

  // Trigger scouting when phase transitions to "scouting"
  useEffect(() => {
    if (phase !== "scouting") return;
    runPreview(citiesToScout ?? undefined)
      .then((l) => {
        setLeads(l);
        setSelected(new Set(l.map((_, i) => i)));
        setPhase("review");
      })
      .catch((err) => {
        setError(err.message);
        setPhase("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function launchScout() {
    if (selectedCities.size === 0) return;
    const cities = Array.from(selectedCities);
    setCitiesToScout(cities);
    setPhase("scouting");
  }

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
      const l = await runPreview(citiesToScout ?? undefined);
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
    setSavedCount(chosen.length);
    setPhase("done");
  }

  async function runEnrich() {
    setPhase("enriching");
    try {
      const res = await fetch("/api/leads/re-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      setEnrichResult({ emailsFound: data.emailsFound ?? 0, total: data.total ?? 0 });
    } catch {
      // best-effort; still navigate on failure
    }
    router.push(`/campaigns/${campaignId}`);
  }

  const subtitle =
    phase === "loading-campaign" || phase === "loading-cities" ? "Loading…"
    : phase === "pick-cities" ? "This campaign has no cities yet — pick cities to scout."
    : phase === "scouting" ? "Step 1 — collecting leads from Google Maps…"
    : phase === "review" ? "Review and select leads to save. Already-saved leads are excluded."
    : phase === "done" ? `${savedCount} leads collected — ready for Step 2.`
    : phase === "enriching" ? "Step 2 — finding emails…"
    : "Something went wrong.";

  return (
    <div className="max-w-220 mx-auto px-4 py-4">
      <Link
        href="/campaigns"
        className="font-mono text-[11px] text-fg-4 hover:text-fg-2 inline-flex items-center gap-1.5 mb-3 transition-colors duration-150"
      >
        ← Campaigns
      </Link>

      <div className="mb-3">
        <h1 className="ds-h1 m-0 mb-0.5">Scout New Leads</h1>
        <p className="font-mono text-[12px] text-fg-4 m-0">{subtitle}</p>
      </div>

      {/* Loading states */}
      {(phase === "loading-campaign" || phase === "loading-cities" || phase === "scouting" || phase === "enriching") && (
        <div className="bg-surface border border-border rounded-xl">
          <RunningIndicator />
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="flex flex-col gap-4">
          <Toast kind="hot" pill="ERROR">{error}</Toast>
          <Button type="button" variant="ghost" onClick={() => router.push("/campaigns")}>
            ← Back to campaigns
          </Button>
        </div>
      )}

      {/* Done — Step 2 prompt */}
      {phase === "done" && (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-amber-bg border border-amber-border flex items-center justify-center mx-auto mb-4">
              <span className="text-amber text-xl">✓</span>
            </div>
            <p className="font-sans text-[28px] font-semibold tracking-[-0.02em] text-amber m-0 mb-1 tabular-nums">
              {savedCount}
            </p>
            <p className="font-mono text-[13px] text-fg-3 m-0">leads collected</p>
            <p className="font-mono text-[12px] text-fg-4 m-0 mt-3 mb-6">
              Step 2 will scrape every lead's website and run targeted web searches to find email addresses.
            </p>
            <div className="flex flex-col gap-2 items-center">
              <Button type="button" size="lg" iconStart="inbox" onClick={runEnrich}>
                Find Emails (Step 2)
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/campaigns/${campaignId}`)}>
                Skip for now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* City picker — shown for campaigns with no saved cities */}
      {phase === "pick-cities" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[12px] text-fg-3 m-0">
              Top cities for <span className="text-fg-1">{campaign?.businessType}</span> in{" "}
              <span className="text-fg-1">{campaign?.country}</span>
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCities(new Set(suggestedCities.map((c) => c.city)))}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCities(new Set())}>
                Clear
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {suggestedCities.map((c) => {
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

          <div className="flex justify-between items-center mt-2">
            <Button type="button" variant="ghost" onClick={() => router.push("/campaigns")}>
              ← Back
            </Button>
            <Button
              type="button"
              size="lg"
              iconStart="play"
              disabled={selectedCities.size === 0}
              onClick={launchScout}
            >
              Scout Leads ({selectedCities.size} {selectedCities.size === 1 ? "city" : "cities"})
            </Button>
          </div>
        </div>
      )}

      {/* Review */}
      {phase === "review" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
