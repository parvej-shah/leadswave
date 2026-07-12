"use client";

import { Button, Label, Select, Textarea, Input } from "@/components/ui";

export type OfferDraft = {
  key?: string; // stable slug; preserved on edit so existing leads keep routing
  label: string;
  matchSignal: string; // has_website | no_website | always
  offerText: string;
  angle?: string;
};

export const DEFAULT_OFFERS: OfferDraft[] = [
  { key: "website_proposal", label: "Website", matchSignal: "no_website", offerText: "" },
  { key: "crm", label: "CRM", matchSignal: "has_website", offerText: "" },
];

const SIGNAL_LABEL: Record<string, string> = {
  no_website: "Business has NO website",
  has_website: "Business HAS a website",
  always: "Any lead (fallback)",
};

/**
 * Repeatable per-campaign offers editor. Each offer routes to leads matching
 * its signal; the AI personalizer uses offerText as the pitch. Generic — no
 * hardcoded website/CRM tracks.
 */
export function OffersEditor({
  offers,
  onChange,
  onGenerate,
  generatingIndex,
  generateDisabled,
}: {
  offers: OfferDraft[];
  onChange: (next: OfferDraft[]) => void;
  /** AI-generate pitch for offer at index; parent owns the API call. */
  onGenerate?: (index: number) => void;
  generatingIndex?: number | null;
  generateDisabled?: boolean;
}) {
  function update(i: number, patch: Partial<OfferDraft>) {
    onChange(offers.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function remove(i: number) {
    onChange(offers.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= offers.length) return;
    const next = offers.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function add() {
    onChange([...offers, { label: "", matchSignal: "always", offerText: "" }]);
  }

  return (
    <div className="flex flex-col gap-4">
      {offers.map((o, i) => (
        <div key={o.key ?? `new-${i}`} className="border border-border rounded-lg p-3 flex flex-col gap-3">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <Label>Offer name</Label>
              <Input
                placeholder="e.g. Website build, CRM, Online booking"
                value={o.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </div>
            <div className="w-[210px]">
              <Label>Send to</Label>
              <Select value={o.matchSignal} onChange={(e) => update(i, { matchSignal: e.target.value })}>
                {Object.entries(SIGNAL_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</Button>
              <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === offers.length - 1} aria-label="Move down">↓</Button>
              <Button variant="ghost" size="sm" onClick={() => remove(i)}>Remove</Button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="m-0">Pitch</Label>
              {onGenerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={generateDisabled || generatingIndex === i}
                  onClick={() => onGenerate(i)}
                >
                  {generatingIndex === i ? "Generating…" : "AI Generate"}
                </Button>
              )}
            </div>
            <Textarea
              rows={2}
              placeholder="What you offer leads in this segment — used by the AI to personalize outreach."
              value={o.offerText}
              onChange={(e) => update(i, { offerText: e.target.value })}
            />
          </div>
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" onClick={add}>+ Add offer</Button>
      </div>
      <p className="font-mono text-[11px] text-fg-5 m-0">
        Leads are matched to the first offer (top to bottom) whose condition fits. Add an
        &quot;Any lead&quot; offer as a catch-all.
      </p>
    </div>
  );
}
