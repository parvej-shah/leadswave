"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CampaignForm, type CampaignFormValues, type SubmitResult } from "../../campaign-form";

export default function EditCampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initial, setInitial] = useState<CampaignFormValues | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch(`/api/campaigns/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load campaign");
        setInitial({
          name: data.name ?? "",
          query: data.query ?? "",
          location: data.location ?? "",
          offerText: data.offerText ?? "",
          status: data.status ?? "active",
        });
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id]);

  async function handleSubmit(values: CampaignFormValues): Promise<SubmitResult> {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? "Failed to update campaign" };
    }
    setTimeout(() => router.push("/campaigns"), 600);
    return { ok: true };
  }

  if (loadError) {
    return (
      <p className="font-mono text-[12px] text-hot border border-hot-border bg-hot-bg rounded-md px-3 py-2 inline-block">
        {loadError}
      </p>
    );
  }

  if (!initial) {
    return <p className="font-mono text-[13px] text-fg-4">Loading campaign…</p>;
  }

  return (
    <CampaignForm
      mode="edit"
      initial={initial}
      onSubmit={handleSubmit}
      submitLabel="Save Campaign"
      submittingLabel="saving…"
    />
  );
}
