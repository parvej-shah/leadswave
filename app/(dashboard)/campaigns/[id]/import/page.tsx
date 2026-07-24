"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ImportWizard } from "./import-wizard";

export default function ImportPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [campaignName, setCampaignName] = useState("");

  useEffect(() => {
    fetch(`/api/campaigns`)
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) => {
        const c = data.find((c) => c.id === campaignId);
        if (c) setCampaignName(c.name);
      })
      .catch(() => {});
  }, [campaignId]);

  return (
    <div className="max-w-220 mx-auto px-4 py-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 font-mono text-[11px] text-fg-5">
        <Link href="/campaigns" className="hover:text-fg-2 transition-colors">
          Campaigns
        </Link>
        <span>›</span>
        <Link href={`/campaigns/${campaignId}`} className="hover:text-fg-2 transition-colors">
          {campaignName || campaignId}
        </Link>
        <span>›</span>
        <span className="text-amber">Import CSV</span>
      </div>

      <h1 className="ds-h1 m-0 mb-0.5">Import Leads from CSV</h1>
      <p className="font-mono text-[12px] text-fg-4 m-0 mb-6">
        Upload a spreadsheet, map the columns, then review and edit before importing.
      </p>

      <ImportWizard campaignId={campaignId} campaignName={campaignName} />
    </div>
  );
}
