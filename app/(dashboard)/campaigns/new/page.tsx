"use client";

import { useRouter } from "next/navigation";
import { CampaignForm, type SubmitResult } from "../campaign-form";

export default function NewCampaignPage() {
  const router = useRouter();

  async function handleSubmit(
    values: { name: string; query: string; location: string; offerText: string; status: string },
    ctx: { toSecondary: () => void }
  ): Promise<SubmitResult> {
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? "Failed to create campaign" };
    }
    const campaign = await res.json();

    ctx.toSecondary();

    const scoutRes = await fetch("/api/agents/scout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id }),
    });
    if (!scoutRes.ok) {
      const data = await scoutRes.json();
      return { ok: false, error: data.error ?? "Scout failed" };
    }
    const scoutData = await scoutRes.json();

    setTimeout(() => router.push("/campaigns"), 2000);

    return {
      ok: true,
      doneCard: {
        count: scoutData.savedCount ?? 0,
        message: "leads discovered",
      },
    };
  }

  return (
    <CampaignForm
      mode="new"
      onSubmit={handleSubmit}
      submitLabel="Launch Campaign"
      submittingLabel="creating campaign…"
      secondaryLabel="scouting leads… (~30s)"
      fetchDefaultOffer
    />
  );
}
