"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Input, Textarea, Toast, Select } from "@/components/ui";

type FormValues = {
  name: string;
  businessType: string;
  country: string;
  websiteOffer: string;
  crmOffer: string;
  status: string;
};

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [form, setForm] = useState<FormValues>({
    name: "",
    businessType: "",
    country: "",
    websiteOffer: "",
    crmOffer: "",
    status: "active",
  });

  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [generatingOffer, setGeneratingOffer] = useState<"website" | "crm" | null>(null);

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load campaign");
        setForm({
          name: data.name ?? "",
          businessType: data.businessType ?? "",
          country: data.country ?? "",
          websiteOffer: data.websiteOffer ?? "",
          crmOffer: data.crmOffer ?? "",
          status: data.status ?? "active",
        });
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

  async function generateOffer(type: "website" | "crm") {
    setGeneratingOffer(type);
    try {
      const res = await fetch("/api/campaigns/description-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: [form.name, form.businessType, form.country].filter(Boolean).join(", "),
          campaignName: form.name,
          query: form.businessType,
          location: form.country,
          offerType: type,
        }),
      });
      const data = await res.json();
      if (res.ok && data.draft) {
        setForm((f) => ({
          ...f,
          [type === "website" ? "websiteOffer" : "crmOffer"]: data.draft,
        }));
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
        body: JSON.stringify(form),
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
          Update targeting and offer text for this campaign.
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
              value={form.businessType}
              onChange={setField("businessType")}
              disabled={saving}
            />
            <Input
              label="Country"
              placeholder='e.g. "Bangladesh"'
              value={form.country}
              onChange={setField("country")}
              disabled={saving}
            />
          </div>

          {/* Offer Templates */}
          <div className="border-t border-border pt-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] text-fg-5 m-0 uppercase tracking-wider">Offer Templates</p>
              <p className="font-mono text-[10px] text-fg-5 m-0">AI will personalize per lead at send time</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Website-proposal offer */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-4">Website-proposal offer</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconStart="sparkle"
                    disabled={saving || generatingOffer === "website" || (!form.name.trim() && !form.businessType.trim())}
                    onClick={() => generateOffer("website")}
                  >
                    {generatingOffer === "website" ? "Generating…" : "AI Generate"}
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Pitch for leads with no website — sell a website build."
                  value={form.websiteOffer}
                  onChange={setField("websiteOffer")}
                  disabled={saving}
                  hint="Used for leads tagged website_proposal."
                />
              </div>

              {/* CRM offer */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-4">CRM offer</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconStart="sparkle"
                    disabled={saving || generatingOffer === "crm" || (!form.name.trim() && !form.businessType.trim())}
                    onClick={() => generateOffer("crm")}
                  >
                    {generatingOffer === "crm" ? "Generating…" : "AI Generate"}
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Pitch for leads that already have a website — sell CRM."
                  value={form.crmOffer}
                  onChange={setField("crmOffer")}
                  disabled={saving}
                  hint="Used for leads tagged crm."
                />
              </div>
            </div>
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
