"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Textarea, Toast } from "@/components/ui";

type SuggestedCity = { city: string; reason: string; score: number };

type Phase = "details" | "cities" | "running" | "done";

export function NewCampaignWizard() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("details");
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [country, setCountry] = useState("");
  const [websiteOffer, setWebsiteOffer] = useState("");
  const [crmOffer, setCrmOffer] = useState("");

  const [cities, setCities] = useState<SuggestedCity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState(0);

  const [error, setError] = useState("");
  const [loadingCities, setLoadingCities] = useState(false);

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
      if (!res.ok) {
        setError(data.error ?? "Failed to suggest cities");
        return;
      }
      setCities(data.cities ?? []);
      setSelected(new Set());
      setPhase("cities");
    } catch {
      setError("Failed to suggest cities");
    } finally {
      setLoadingCities(false);
    }
  }

  function toggleCity(city: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  }

  async function launch() {
    setError("");
    const selectedCities = Array.from(selected);
    if (selectedCities.length === 0) {
      setError("Pick at least one city.");
      return;
    }

    setPhase("running");

    const createRes = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, businessType, country, selectedCities, websiteOffer, crmOffer }),
    });
    if (!createRes.ok) {
      const data = await createRes.json();
      setError(data.error ?? "Failed to create campaign");
      setPhase("cities");
      return;
    }
    const campaign = await createRes.json();

    const scoutRes = await fetch("/api/agents/scout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id }),
    });
    if (!scoutRes.ok) {
      const data = await scoutRes.json();
      setError(data.error ?? "Lead gathering failed");
      setPhase("cities");
      return;
    }
    const scoutData = await scoutRes.json();
    setSavedCount(scoutData.savedCount ?? 0);
    setPhase("done");
    setTimeout(() => router.push("/campaigns"), 2000);
  }

  if (phase === "done") {
    return (
      <div className="max-w-[560px]">
        <div className="bg-surface border border-border rounded-xl">
          <div className="text-center py-8 px-6">
            <p className="font-sans text-[36px] font-semibold tracking-[-0.02em] text-amber m-0 mb-1.5 tabular-nums">
              {savedCount}
            </p>
            <p className="font-mono text-[13px] text-fg-3 m-0">leads gathered & categorized</p>
            <p className="font-mono text-[11px] text-fg-5 m-0 mt-4">redirecting to campaigns…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[560px]">
      <div className="mb-6">
        <Link
          href="/campaigns"
          className="font-mono text-[11px] text-fg-4 hover:text-fg-2 inline-flex items-center gap-1.5 mb-3 transition-colors duration-150"
        >
          ← Campaigns
        </Link>
        <h1 className="ds-h1 m-0 mb-1">New Campaign</h1>
        <p className="font-mono text-[12px] text-fg-4 m-0">
          {phase === "cities"
            ? "Pick the cities to gather leads from on Google Maps."
            : "Tell us the business type and country — AI ranks the best cities."}
        </p>
      </div>

      {phase === "details" && (
        <div className="flex flex-col gap-5">
          <Input
            label="Campaign Name"
            placeholder="e.g. BD dentists Q2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Business Type"
            placeholder='e.g. "dentists"'
            hint="What kind of business are you targeting?"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
          />
          <Input
            label="Country"
            placeholder='e.g. "Bangladesh"'
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <Textarea
            label="Website-proposal offer"
            rows={3}
            placeholder="Pitch for leads with no website (sell a website build)."
            value={websiteOffer}
            onChange={(e) => setWebsiteOffer(e.target.value)}
            hint="Optional — used later for leads with no website."
          />
          <Textarea
            label="CRM offer"
            rows={3}
            placeholder="Pitch for leads that already have a website (sell CRM)."
            value={crmOffer}
            onChange={(e) => setCrmOffer(e.target.value)}
            hint="Optional — used later for leads that have a website."
          />

          {error && (
            <Toast kind="hot" pill="ERROR">
              {error}
            </Toast>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Link href="/campaigns">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
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

      {phase === "cities" && (
        <div className="flex flex-col gap-5">
          <div>
            <Label>Top cities for {businessType} in {country}</Label>
            <div className="flex flex-col gap-2 mt-1">
              {cities.map((c) => {
                const active = selected.has(c.city);
                return (
                  <button
                    key={c.city}
                    type="button"
                    onClick={() => toggleCity(c.city)}
                    className={
                      "flex items-start gap-3 text-left rounded-md border px-3 py-2.5 transition-colors duration-150 cursor-pointer " +
                      (active
                        ? "bg-amber-bg border-amber-border"
                        : "bg-[oklch(0.13_0_0)] border-[oklch(0.22_0_0)] hover:border-[oklch(0.28_0_0)]")
                    }
                  >
                    <span
                      className={
                        "mt-0.5 w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 " +
                        (active ? "bg-amber border-amber text-canvas" : "border-[oklch(0.3_0_0)]")
                      }
                    >
                      {active ? "✓" : ""}
                    </span>
                    <span className="flex-1">
                      <span className="font-mono text-[13px] text-fg-2 flex items-center gap-2">
                        {c.city}
                        <span className="text-fg-5 text-[11px]">· {c.score}</span>
                      </span>
                      {c.reason && (
                        <span className="block font-mono text-[11px] text-fg-4 mt-0.5">{c.reason}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <Toast kind="hot" pill="ERROR">
              {error}
            </Toast>
          )}

          <div className="flex justify-between gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => setPhase("details")}>
              ← Back
            </Button>
            <Button type="button" size="lg" onClick={launch} iconStart="play">
              Launch ({selected.size})
            </Button>
          </div>
        </div>
      )}

      {phase === "running" && (
        <div className="bg-surface border border-border rounded-xl">
          <div className="text-center py-8 px-6">
            <p className="font-mono text-[13px] text-fg-3 m-0">
              searching Google Maps & categorizing leads…
            </p>
            <p className="font-mono text-[11px] text-fg-5 m-0 mt-2">this can take a minute</p>
          </div>
        </div>
      )}
    </div>
  );
}
