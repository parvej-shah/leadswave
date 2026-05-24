"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "creating" | "scouting" | "done" | "error";

export default function NewCampaignPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [keywords, setKeywords] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const [form, setForm] = useState({
    name: "",
    query: "",
    location: "",
    offerText: "",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.offerText) setForm((f) => ({ ...f, offerText: s.offerText }));
      })
      .catch(() => {});
  }, []);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.query.trim() || !form.location.trim()) {
      setError("Name, query, and location are required.");
      return;
    }

    setStatus("creating");

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create campaign");
      setStatus("error");
      return;
    }

    const campaign = await res.json();
    setStatus("scouting");

    const scoutRes = await fetch("/api/agents/scout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id }),
    });

    if (!scoutRes.ok) {
      const data = await scoutRes.json();
      setError(data.error ?? "Scout failed");
      setStatus("error");
      return;
    }

    const scoutData = await scoutRes.json();
    setSavedCount(scoutData.savedCount ?? 0);
    setStatus("done");

    setTimeout(() => router.push(`/campaigns`), 2000);
  }

  async function handleGenerateDescription() {
    if (!keywords.trim()) {
      setError("Add a few keywords first, then click AI Write.");
      return;
    }
    setError("");
    setGeneratingDescription(true);
    try {
      const res = await fetch("/api/campaigns/description-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          campaignName: form.name,
          query: form.query,
          location: form.location,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate description");
        return;
      }
      setForm((f) => ({ ...f, offerText: data.draft ?? f.offerText }));
    } catch {
      setError("Failed to generate description");
    } finally {
      setGeneratingDescription(false);
    }
  }

  const inputCls =
    "w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[oklch(0.78_0.18_65)] focus:ring-1 focus:ring-[oklch(0.78_0.18_65)] transition-colors";

  const labelCls = "block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider";

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1
          className="text-xl font-semibold text-zinc-100 mb-1"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          New Campaign
        </h1>
        <p className="text-sm text-zinc-500">
          Scout finds companies matching your query and saves them as leads.
        </p>
      </div>

      {status === "done" ? (
        <div className="rounded border border-zinc-700 bg-zinc-900 p-6 text-center">
          <div
            className="text-3xl font-bold mb-1"
            style={{ color: "oklch(0.78 0.18 65)", fontFamily: "'DM Mono', monospace" }}
          >
            {savedCount}
          </div>
          <p className="text-sm text-zinc-400">leads discovered</p>
          <p className="text-xs text-zinc-600 mt-3">redirecting to campaigns…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className={labelCls}>Campaign name</label>
            <input
              className={inputCls}
              placeholder="e.g. BD law firms Q2"
              value={form.name}
              onChange={set("name")}
              disabled={status !== "idle" && status !== "error"}
            />
          </div>

          <div>
            <label className={labelCls}>Search query</label>
            <input
              className={inputCls}
              placeholder='e.g. "digital marketing agencies"'
              value={form.query}
              onChange={set("query")}
              disabled={status !== "idle" && status !== "error"}
            />
            <p className="text-xs text-zinc-600 mt-1">
              What kind of business are you targeting?
            </p>
          </div>

          <div>
            <label className={labelCls}>Location</label>
            <input
              className={inputCls}
              placeholder='e.g. "Dhaka, Bangladesh"'
              value={form.location}
              onChange={set("location")}
              disabled={status !== "idle" && status !== "error"}
            />
          </div>

          <div>
            <label className={labelCls}>Offer description</label>
            <div className="flex items-center gap-2 mb-2">
              <input
                className={`${inputCls} flex-1`}
                placeholder="Keywords for AI (e.g. MVP development, SaaS founders, rapid launch)"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={status !== "idle" && status !== "error"}
              />
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={(status !== "idle" && status !== "error") || generatingDescription}
                className="px-3 py-2 rounded text-xs border border-zinc-700 text-zinc-200 hover:border-zinc-500 disabled:opacity-60 transition-colors"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                {generatingDescription ? "AI Writing..." : "AI Write"}
              </button>
            </div>
            <textarea
              className={`${inputCls} resize-none h-24`}
              placeholder="What are you offering? AI will personalize this per lead."
              value={form.offerText}
              onChange={set("offerText")}
              disabled={status !== "idle" && status !== "error"}
            />
            <p className="text-xs text-zinc-600 mt-1">
              Pre-filled from settings — edit per campaign if needed.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 border border-red-900/50 bg-red-950/30 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "creating" || status === "scouting"}
            className="mt-1 px-4 py-2.5 rounded text-sm font-medium text-zinc-900 transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "oklch(0.78 0.18 65)", fontFamily: "'DM Mono', monospace" }}
          >
            {status === "creating"
              ? "creating campaign…"
              : status === "scouting"
              ? "scouting leads… (this takes ~30s)"
              : "Launch Campaign"}
          </button>
        </form>
      )}
    </div>
  );
}
