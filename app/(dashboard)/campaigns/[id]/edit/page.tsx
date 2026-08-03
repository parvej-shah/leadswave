"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Input, Toast, Select } from "@/components/ui";
import { OffersEditor, DEFAULT_OFFERS, type OfferDraft } from "@/components/offers-editor";
import { SequenceBuilder } from "@/components/campaigns/sequence-builder";

type FormValues = {
  name: string;
  businessType: string;
  country: string;
  status: string;
  scoutDepth: string;
  followupDays: string; // comma-separated days after opener, e.g. "3,7"
};

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [form, setForm] = useState<FormValues>({
    name: "",
    businessType: "",
    country: "",
    status: "active",
    scoutDepth: "normal",
    followupDays: "3",
  });
  const [offers, setOffers] = useState<OfferDraft[]>([]);
  const [knownTypes, setKnownTypes] = useState<string[]>([]);

  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [generatingOffer, setGeneratingOffer] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/business-types")
      .then((r) => (r.ok ? r.json() : []))
      .then((types: { name: string }[]) => setKnownTypes(types.map((t) => t.name)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load campaign");
        setForm({
          name: data.name ?? "",
          businessType: data.businessType ?? "",
          country: data.country ?? "",
          status: data.status ?? "active",
          scoutDepth: data.scoutDepth ?? "normal",
          followupDays: (data.followupOffsets ?? [3]).join(","),
        });
        const loaded: OfferDraft[] = (data.offers ?? []).map(
          (o: { key: string; label: string; matchSignal: string; offerText: string; angle: string | null }) => ({
            key: o.key,
            label: o.label,
            matchSignal: o.matchSignal,
            offerText: o.offerText,
            angle: o.angle ?? undefined,
          }),
        );
        // Legacy campaigns without offer rows: surface the old two-track
        // columns as editable offers so nothing silently disappears.
        setOffers(
          loaded.length
            ? loaded
            : DEFAULT_OFFERS.map((d) => ({
                ...d,
                offerText: d.key === "website_proposal" ? data.websiteOffer ?? "" : data.crmOffer ?? "",
              })),
        );
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id]);

  function setField<K extends keyof FormValues>(field: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setError("");
      setSaved(false);
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function generateOffer(index: number) {
    const offer = offers[index];
    if (!offer) return;
    setGeneratingOffer(index);
    try {
      const res = await fetch("/api/campaigns/description-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: [form.name, form.businessType, form.country, offer.label].filter(Boolean).join(", "),
          campaignName: form.name,
          query: form.businessType,
          location: form.country,
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    if (!form.name.trim()) {
      setError("Campaign name is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          businessType: form.businessType,
          country: form.country,
          status: form.status,
          scoutDepth: form.scoutDepth,
          followupOffsets: form.followupDays
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n)),
          offers: offers.filter((o) => o.label.trim() && o.offerText.trim()),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save campaign");
        return;
      }
      setSaved(true);
      setTimeout(() => router.push("/campaigns"), 800);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <p className="font-mono text-[12px] text-hot border border-hot-border bg-hot-bg rounded-md px-3 py-2 inline-block">
        {loadError}
      </p>
    );
  }

  if (!form.name && !loadError) {
    return <p className="font-mono text-[13px] text-fg-4">Loading campaign…</p>;
  }

  return (
    <div className="max-w-220 mx-auto px-4 py-4">
      <Link
        href="/campaigns"
        className="font-mono text-[11px] text-fg-4 hover:text-fg-2 inline-flex items-center gap-1.5 mb-3 transition-colors duration-150"
      >
        ← Campaigns
      </Link>

      <div className="mb-3">
        <h1 className="ds-h1 m-0 mb-0.5">Edit Campaign</h1>
        <p className="font-mono text-[12px] text-fg-4 m-0">
          Update targeting and offers for this campaign.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
          {/* Row 1: Name + Status */}
          <div className="grid grid-cols-[1fr_160px] gap-3">
            <Input
              label="Campaign Name"
              placeholder="e.g. BD dentists Q2"
              value={form.name}
              onChange={setField("name")}
              disabled={saving}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={setField("status")}
              disabled={saving}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="completed">completed</option>
            </Select>
          </div>

          {/* Row 2: Business Type + Country */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Business Type"
              placeholder='e.g. "dentists"'
              hint="What kind of business are you targeting?"
              list="known-business-types"
              value={form.businessType}
              onChange={setField("businessType")}
              disabled={saving}
            />
            <datalist id="known-business-types">
              {knownTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <Input
              label="Country"
              placeholder='e.g. "Bangladesh"'
              value={form.country}
              onChange={setField("country")}
              disabled={saving}
            />
          </div>

          {/* Row 3: Scouting depth + follow-up cadence */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Scouting depth"
              value={form.scoutDepth}
              onChange={setField("scoutDepth")}
              disabled={saving}
            >
              <option value="light">Light — quick sample, lowest API cost</option>
              <option value="normal">Normal — balanced (recommended)</option>
              <option value="deep">Deep — maximum coverage</option>
            </Select>
            <div>
              <p className="font-mono text-[11px] text-fg-5 uppercase tracking-wider m-0 mb-2">Sequence</p>
              <SequenceBuilder
                value={form.followupDays
                  ? form.followupDays.split(",").map(Number).filter((n) => Number.isFinite(n) && n >= 2)
                  : [3]}
                onChange={(offsets) =>
                  setForm((f) => ({ ...f, followupDays: offsets.join(",") }))
                }
                disabled={saving}
              />
            </div>
          </div>

          {/* Offers */}
          <div className="border-t border-border pt-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] text-fg-5 m-0 uppercase tracking-wider">Offers</p>
              <p className="font-mono text-[10px] text-fg-5 m-0">AI will personalize per lead at send time</p>
            </div>
            <OffersEditor
              offers={offers}
              onChange={(next) => {
                setSaved(false);
                setOffers(next);
              }}
              onGenerate={generateOffer}
              generatingIndex={generatingOffer}
              generateDisabled={saving || (!form.name.trim() && !form.businessType.trim())}
            />
          </div>

          {error && <Toast kind="hot" pill="ERROR">{error}</Toast>}
          {saved && !error && <Toast kind="success" pill="SAVED">Campaign saved.</Toast>}

          <div className="flex justify-between items-center pt-0.5">
            <Link href="/campaigns">
              <Button type="button" variant="ghost" disabled={saving}>
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              size="lg"
              disabled={saving}
              iconStart={saving ? "refresh" : "check"}
            >
              {saving ? "Saving…" : "Save Campaign"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
