"use client";

import { Button, Input } from "@/components/ui";

type SequenceBuilderProps = {
  value: number[]; // followupOffsets, e.g. [3, 7]
  onChange: (offsets: number[]) => void;
  disabled?: boolean;
};

export function SequenceBuilder({ value, onChange, disabled }: SequenceBuilderProps) {
  function setDay(index: number, days: number) {
    const clamped = Math.max(2, Math.min(30, isNaN(days) ? 2 : days));
    const next = [...value];
    next[index] = clamped;
    onChange(next);
  }

  function addStep() {
    if (value.length >= 3) return;
    onChange([...value, 3]);
  }

  function removeStep(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Opener — Step 1, always AI-generated */}
      <div className="rounded-xl border border-amber-border bg-amber-bg px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full border border-amber bg-amber text-canvas font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
            1
          </span>
          <div>
            <p className="font-mono text-[13px] text-fg-1 font-medium m-0">Opener</p>
            <p className="font-mono text-[11px] text-fg-4 m-0 mt-0.5">
              AI-generated · personalized per lead · always sent first
            </p>
          </div>
        </div>
      </div>

      {value.map((days, i) => (
        <div key={i}>
          {/* Connector with wait days */}
          <div className="flex items-center gap-2 px-5 py-2">
            <div className="w-px h-4 bg-border ml-2.5 shrink-0" />
            <span className="font-mono text-[11px] text-fg-5 shrink-0">↓ wait</span>
            <Input
              type="number"
              min={2}
              max={30}
              value={days}
              onChange={(e) => setDay(i, parseInt(e.target.value, 10))}
              disabled={disabled}
              className="w-16 text-center py-1 text-[12px]"
            />
            <span className="font-mono text-[11px] text-fg-5 shrink-0">days</span>
          </div>

          {/* Follow-up step card */}
          <div className="rounded-xl border border-border bg-[oklch(0.12_0_0)] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full border border-border text-fg-4 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                {i + 2}
              </span>
              <div>
                <p className="font-mono text-[13px] text-fg-2 font-medium m-0">Follow-up</p>
                <p className="font-mono text-[11px] text-fg-5 m-0 mt-0.5">
                  AI-generated · sends {days}d after previous step
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeStep(i)}
              disabled={disabled}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}

      {value.length < 3 && (
        <div className="flex items-center gap-2 px-5 pt-2">
          <div className="w-px h-4 bg-border ml-2.5 shrink-0" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconStart="plus"
            onClick={addStep}
            disabled={disabled}
          >
            Add follow-up step
          </Button>
        </div>
      )}

      <p className="font-mono text-[10px] text-fg-5 mt-3 mb-0">
        Max 3 follow-ups · wait days: 2–30 · opener is always AI-personalized
      </p>
    </div>
  );
}
