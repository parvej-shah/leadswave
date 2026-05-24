"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type FormState = {
  name: string;
  query: string;
  location: string;
  offerText: string;
  status: string;
};

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    query: "",
    location: "",
    offerText: "",
    status: "active",
  });
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load campaign");
        setForm({
          name: data.name ?? "",
          query: data.query ?? "",
          location: data.location ?? "",
          offerText: data.offerText ?? "",
          status: data.status ?? "active",
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function setField(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.name.trim() || !form.query.trim() || !form.location.trim()) {
      setError("Name, query, and location are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update campaign");
        return;
      }
      setSuccess("Campaign updated.");
      setTimeout(() => router.push("/campaigns"), 900);
    } catch {
      setError("Failed to update campaign");
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return <div className="text-sm text-zinc-500">Loading campaign...</div>;
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-semibold text-zinc-100 mb-1"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            Edit Campaign
          </h1>
          <p className="text-sm text-zinc-500">Update targeting and offer text for this campaign.</p>
        </div>
        <Link href="/campaigns" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
          Back
        </Link>
      </div>

      <form onSubmit={onSave} className="flex flex-col gap-5">
        <div>
          <label className={labelCls}>Campaign name</label>
          <input className={inputCls} value={form.name} onChange={setField("name")} disabled={saving} />
        </div>
        <div>
          <label className={labelCls}>Search query</label>
          <input className={inputCls} value={form.query} onChange={setField("query")} disabled={saving} />
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input className={inputCls} value={form.location} onChange={setField("location")} disabled={saving} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={form.status} onChange={setField("status")} disabled={saving}>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="completed">completed</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Offer description</label>
          <div className="flex items-center gap-2 mb-2">
            <input
              className={`${inputCls} flex-1`}
              placeholder="Keywords for AI (e.g. MVP development, SaaS founders, rapid launch)"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={saving}
            />
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={saving || generatingDescription}
              className="px-3 py-2 rounded text-xs border border-zinc-700 text-zinc-200 hover:border-zinc-500 disabled:opacity-60 transition-colors"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {generatingDescription ? "AI Writing..." : "AI Write"}
            </button>
          </div>
          <textarea
            className={`${inputCls} resize-none h-24`}
            value={form.offerText}
            onChange={setField("offerText")}
            disabled={saving}
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 border border-red-900/50 bg-red-950/30 rounded px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-xs text-emerald-400 border border-emerald-900/50 bg-emerald-950/30 rounded px-3 py-2">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-1 px-4 py-2.5 rounded text-sm font-medium text-zinc-900 transition-opacity disabled:opacity-60"
          style={{ backgroundColor: "oklch(0.78 0.18 65)", fontFamily: "'DM Mono', monospace" }}
        >
          {saving ? "Saving..." : "Save Campaign"}
        </button>
      </form>
    </div>
  );
}
