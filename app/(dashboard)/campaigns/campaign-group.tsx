"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CampaignRow, type CampaignRowData } from "./campaign-row";

export type CampaignGroupData = {
  typeId: string | null;
  typeName: string;
  campaigns: CampaignRowData[];
  leads: number;
};

export function CampaignGroup({ group, defaultOpen = true }: { group: CampaignGroupData; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const count = group.campaigns.length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 px-0.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 min-w-0 group cursor-pointer"
        >
          <Icon
            name="chevron"
            size={14}
            className={cn("text-fg-4 transition-transform duration-150 shrink-0", open && "rotate-90")}
          />
          <span className="font-sans text-[13px] font-semibold text-fg-2 tracking-[-0.01em] truncate group-hover:text-fg-1 transition-colors">
            {group.typeName}
          </span>
          <span className="font-mono text-[11px] text-fg-5 shrink-0">
            {count} campaign{count === 1 ? "" : "s"} · {group.leads} leads
          </span>
        </button>
        {group.typeId && (
          <Link
            href={`/map?businessTypeId=${group.typeId}`}
            className="font-mono text-[11px] text-fg-5 hover:text-amber transition-colors shrink-0 ml-auto"
          >
            View on map →
          </Link>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2.5 animate-in fade-in duration-200">
          {group.campaigns.map((c) => (
            <CampaignRow key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
