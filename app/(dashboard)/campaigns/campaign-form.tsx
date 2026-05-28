"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Input, Label, Select, Textarea, Toast } from "@/components/ui";

export type CampaignFormValues = {
  name: string;
  query: string;
  location: string;
  offerText: string;
  websiteOffer: string;
  crmOffer: string;
  status: string;
};

export type SubmitResult =
  | { ok: true; redirect?: string; doneCard?: { count: number; message: string } }
  | { ok: false; error: string };

export type SubmitContext = {
  /** Move to the secondary in-progress label (e.g. "scouting leads…"). */
  toSecondary: () => void;
};

export type CampaignFormProps = {
  mode: "new" | "edit";
  initial?: Partial<CampaignFormValues>;
  /** Called on submit. Return ok=false to show inline error. */
  onSubmit: (values: CampaignFormValues, ctx: SubmitContext) => Promise<SubmitResult>;
  /** Submit label / state copy. */
  submitLabel: string;
  /** Lowercase in-progress copy ("creating campaign…"). */
  submittingLabel: string;
  /** Optional second submit state (e.g. "scouting leads… (~30s)"). */
  secondaryLabel?: string;
  /** Pre-fill offerText from /api/settings on mount (new mode only). */
  fetchDefaultOffer?: boolean;
};

export function CampaignForm({
  mode,
  initial,
  onSubmit,
  submitLabel,
  submittingLabel,
  secondaryLabel,
  fetchDefaultOffer,
}: CampaignFormProps) {
  const [form, setForm] = useState<CampaignFormValues>({
    name: initial?.name ?? "",
    query: initial?.query ?? "",
    location: initial?.location ?? "",
    offerText: initial?.offerText ?? "",
    websiteOffer: initial?.websiteOffer ?? "",
    crmOffer: initial?.crmOffer ?? "",
    status: initial?.status ?? "active",
  });
  const [keywords, setKeywords] = useState("");
  const [phase, setPhase] = useState<"idle" | "submitting" | "secondary" | "done">("idle");
  const [doneCard, setDoneCard] = useState<{ count: number; message: string } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);

  useEffect(() => {
    if (!fetchDefaultOffer) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.offerText) setForm((f) => (f.offerText ? f : { ...f, offerText: s.offerText }));
      })
      .catch(() => {});
  }, [fetchDefaultOffer]);

  const disabled = phase !== "idle";

  function setField<K extends keyof CampaignFormValues>(field: K) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name.trim() || !form.query.trim() || !form.location.trim()) {
      setError("Name, query, and location are required.");
      return;
    }

    setPhase("submitting");
    const result = await onSubmit(form, { toSecondary: () => setPhase("secondary") });

    if (!result.ok) {
      setError(result.error);
      setPhase("idle");
      return;
    }

    if (result.doneCard) {
      setDoneCard(result.doneCard);
      setPhase("done");
      return;
    }

    setSuccess("Saved.");
    setPhase("idle");
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

  if (phase === "done" && doneCard) {
    return (
      <div className="max-w-[560px]">
        <div className="bg-surface border border-border rounded-xl">
          <div className="text-center py-8 px-6">
            <p
              className="font-sans text-[36px] font-semibold tracking-[-0.02em] text-amber m-0 mb-1.5 tabular-nums"
            >
              {doneCard.count}
            </p>
            <p className="font-mono text-[13px] text-fg-3 m-0">{doneCard.message}</p>
            <p className="font-mono text-[11px] text-fg-5 m-0 mt-4">
              redirecting to campaigns…
            </p>
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
        <h1 className="ds-h1 m-0 mb-1">
          {mode === "new" ? "New Campaign" : "Edit Campaign"}
        </h1>
        <p className="font-mono text-[12px] text-fg-4 m-0">
          {mode === "new"
            ? "Scout finds companies matching your query and saves them as leads."
            : "Update targeting and offer text for this campaign."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Campaign Name"
          placeholder="e.g. BD law firms Q2"
          value={form.name}
          onChange={setField("name")}
          disabled={disabled}
        />

        <Input
          label="Search Query"
          placeholder='e.g. "digital marketing agencies"'
          hint="What kind of business are you targeting?"
          value={form.query}
          onChange={setField("query")}
          disabled={disabled}
        />

        <Input
          label="Location"
          placeholder='e.g. "New York, NY"'
          value={form.location}
          onChange={setField("location")}
          disabled={disabled}
        />

        {mode === "edit" && (
          <Select label="Status" value={form.status} onChange={setField("status")} disabled={disabled}>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="completed">completed</option>
          </Select>
        )}

        {mode === "edit" && (
          <>
            <Textarea
              label="Website-proposal offer"
              rows={3}
              placeholder="Pitch for leads with no website (sell a website build)."
              value={form.websiteOffer}
              onChange={setField("websiteOffer")}
              disabled={disabled}
              hint="Used for leads tagged website_proposal."
            />
            <Textarea
              label="CRM offer"
              rows={3}
              placeholder="Pitch for leads that already have a website (sell CRM)."
              value={form.crmOffer}
              onChange={setField("crmOffer")}
              disabled={disabled}
              hint="Used for leads tagged crm."
            />
          </>
        )}

        <div>
          <Label>Offer Description</Label>
          <div className="flex gap-2 mb-2.5">
            <div className="flex-1">
              <Input
                placeholder="Keywords for AI (e.g. MVP, SaaS founders, rapid launch)"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={disabled}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              iconStart="sparkle"
              onClick={handleGenerateDescription}
              disabled={disabled || generatingDescription}
            >
              {generatingDescription ? "AI Writing…" : "AI Write"}
            </Button>
          </div>
          <Textarea
            rows={5}
            placeholder="What are you offering? AI will personalize this per lead."
            value={form.offerText}
            onChange={setField("offerText")}
            disabled={disabled}
            hint={
              mode === "new"
                ? "Pre-filled from Settings — edit per campaign if needed."
                : undefined
            }
          />
        </div>

        {error && (
          <Toast kind="hot" pill="ERROR">
            {error}
          </Toast>
        )}
        {success && !error && (
          <Toast kind="success" pill="SAVED">
            {success}
          </Toast>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Link href="/campaigns">
            <Button type="button" variant="ghost" disabled={disabled}>
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            size="lg"
            disabled={disabled}
            iconStart={phase === "submitting" || phase === "secondary" ? "refresh" : "play"}
          >
            {phase === "submitting"
              ? submittingLabel
              : phase === "secondary" && secondaryLabel
              ? secondaryLabel
              : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
