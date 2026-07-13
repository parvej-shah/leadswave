"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Textarea, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toaster";
import type { BusinessTypeStat } from "@/lib/business-type-stats";

export function TypeCard({ stat }: { stat: BusinessTypeStat }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [offer, setOffer] = useState(stat.defaultOffer ?? "");
  const [saved, setSaved] = useState(stat.defaultOffer ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/business-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stat.id, defaultOffer: offer }),
      });
      if (!res.ok) throw new Error();
      setSaved(offer);
      setEditing(false);
      toast({ kind: "success", message: `Default offer saved for ${stat.name}` });
    } catch {
      toast({ kind: "hot", message: "Couldn't save the default offer" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-border hover:border-border-strong rounded-xl p-4 flex flex-col gap-3.5 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-sans text-[15px] font-semibold text-fg-1 tracking-[-0.01em] m-0 truncate">
            {stat.name}
          </h3>
          <p className="font-mono text-[11px] text-fg-4 m-0 mt-0.5">
            {stat.campaignCount} campaign{stat.campaignCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {stat.meetings > 0 && <Badge variant="info" size="sm">{stat.meetings}M</Badge>}
          {stat.replied > 0 && <Badge variant="hot" size="sm">{stat.replied}R</Badge>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="LEADS" value={stat.leads} />
        <Stat label="CONTACTED" value={`${stat.contactedPct}%`} />
        <Stat label="MAPPED" value={`${stat.mappedPct}%`} />
      </div>

      {/* Coverage bar */}
      <div>
        <div className="h-[4px] w-full bg-[oklch(0.16_0_0)] rounded-[2px] overflow-hidden">
          <div
            className="h-full bg-amber transition-[width] duration-500"
            style={{ width: `${stat.contactedPct}%` }}
          />
        </div>
      </div>

      {/* Default offer */}
      <div className="border-t border-border pt-3">
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              label="Default offer"
              hint="Inherited by new campaigns of this type when they don't set their own."
              rows={3}
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOffer(saved);
                  setEditing(false);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-5 m-0 mb-1">
                Default offer
              </p>
              <p className="font-mono text-[11px] text-fg-3 m-0 line-clamp-2">
                {saved || <span className="text-fg-5 italic">None set — campaigns fall back to settings.</span>}
              </p>
            </div>
            <Button size="sm" variant="ghost" iconStart="pencil" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Footer link */}
      <div className="flex items-center gap-2 pt-0.5">
        <Link href={`/map?businessTypeId=${stat.id}`} className="flex-1">
          <Button size="sm" variant="secondary" iconStart="map" className="w-full">
            View coverage on map
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[3px]">
      <p className="font-mono text-[9px] uppercase tracking-[0.10em] text-fg-5 m-0">{label}</p>
      <span className="font-sans text-[16px] font-semibold tracking-[-0.02em] tabular-nums text-fg-1">
        {value}
      </span>
    </div>
  );
}
