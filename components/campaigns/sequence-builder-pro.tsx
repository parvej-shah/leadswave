"use client";

import { useState } from "react";
import { Button, Icon, Input } from "@/components/ui";

export type Variant = {
  id: string;
  label: string; // "A", "B", "C"
  enabled: boolean;
  subject: string;
  body: string;
};

export type SequenceStep = {
  step: number;
  waitDays: number;
  variants: Variant[];
};

type SequenceBuilderProProps = {
  initialSteps?: SequenceStep[];
  campaignName?: string;
  businessType?: string;
  offerText?: string;
  onSave?: (steps: SequenceStep[]) => Promise<void>;
  disabled?: boolean;
};

const DEFAULT_STEPS: SequenceStep[] = [
  {
    step: 1,
    waitDays: 0,
    variants: [
      {
        id: "v1-a",
        label: "A",
        enabled: true,
        subject: "{{firstname}}, a thought for {{companyname}}",
        body: `Hi {{firstname}},\n\nWould you be interested in exploring AI automation if it could help your team screen more candidates and significantly shorten time-to-hire?\n\nThis year in Q1, we deployed this solution internally and our team now uses it as a core part of operations.\n\nShould I share the one-page solution concept we prepared for it?\n\nRegards,\nXpeedLab Team`,
      },
      {
        id: "v1-b",
        label: "B",
        enabled: true,
        subject: "Could {{companyname}} screen more candidates?",
        body: `Hi {{firstname}},\n\nNoticed {{companyname}}'s work. Quick question: are you open to an AI voice assistant that handles lead follow-ups within 60 seconds?\n\nLet me know if you'd like a 2-minute demo video.`,
      },
      {
        id: "v1-c",
        label: "C",
        enabled: false,
        subject: "More client-ready shortlists per recruiter...",
        body: `Hi {{firstname}},\n\nReaching out briefly regarding automation. Would love to share how similar teams saved 15+ hours per week.`,
      },
    ],
  },
];

export function SequenceBuilderPro({
  initialSteps = DEFAULT_STEPS,
  campaignName = "",
  businessType = "",
  offerText = "",
  onSave,
  disabled,
}: SequenceBuilderProProps) {
  const [steps, setSteps] = useState<SequenceStep[]>(initialSteps);
  const [selectedStepIdx, setSelectedStepIdx] = useState(0);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Gemini AI Assistant state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPromptHint, setAiPromptHint] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<{ subject: string; body: string } | null>(null);

  const currentStep = steps[selectedStepIdx] ?? steps[0];
  const currentVariant = currentStep?.variants[selectedVariantIdx] ?? currentStep?.variants[0];

  function handleAddVariant(stepIdx: number) {
    const step = steps[stepIdx];
    if (!step) return;
    const labels = ["A", "B", "C", "D", "E"];
    const nextLabel = labels[step.variants.length] ?? `V${step.variants.length + 1}`;
    const newVariant: Variant = {
      id: `v${step.step}-${Date.now()}`,
      label: nextLabel,
      enabled: true,
      subject: `Variant ${nextLabel}: {{companyname}}`,
      body: `Hi {{firstname}},\n\nHere is variant ${nextLabel} draft.`,
    };
    const nextSteps = [...steps];
    nextSteps[stepIdx].variants.push(newVariant);
    setSteps(nextSteps);
    setSelectedVariantIdx(step.variants.length - 1);
  }

  function handleAddStep() {
    const nextStepNum = steps.length + 1;
    const newStep: SequenceStep = {
      step: nextStepNum,
      waitDays: 3,
      variants: [
        {
          id: `v${nextStepNum}-a`,
          label: "A",
          enabled: true,
          subject: `Re: {{firstname}}`,
          body: `Hi {{firstname}},\n\nFollowing up on my previous message. Any thoughts?`,
        },
      ],
    };
    setSteps([...steps, newStep]);
    setSelectedStepIdx(steps.length);
    setSelectedVariantIdx(0);
  }

  function handleToggleVariant(stepIdx: number, variantIdx: number) {
    const nextSteps = [...steps];
    const target = nextSteps[stepIdx]?.variants[variantIdx];
    if (target) target.enabled = !target.enabled;
    setSteps(nextSteps);
  }

  function handleDeleteVariant(stepIdx: number, variantIdx: number) {
    const step = steps[stepIdx];
    if (!step || step.variants.length <= 1) return;
    const nextSteps = [...steps];
    nextSteps[stepIdx].variants = step.variants.filter((_, i) => i !== variantIdx);
    setSteps(nextSteps);
    if (selectedVariantIdx >= nextSteps[stepIdx].variants.length) {
      setSelectedVariantIdx(Math.max(0, nextSteps[stepIdx].variants.length - 1));
    }
  }

  function updateCurrentVariant(fields: Partial<Variant>) {
    const nextSteps = [...steps];
    const target = nextSteps[selectedStepIdx]?.variants[selectedVariantIdx];
    if (target) {
      Object.assign(target, fields);
      setSteps(nextSteps);
    }
  }

  function insertVariable(varName: string) {
    if (!currentVariant) return;
    updateCurrentVariant({
      body: (currentVariant.body ?? "") + ` {{${varName}}}`,
    });
  }

  async function handleGenerateAiDraft() {
    setGeneratingAi(true);
    setAiGeneratedResult(null);
    try {
      const res = await fetch("/api/campaigns/sequence-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName,
          businessType,
          offerText,
          stepNum: currentStep?.step ?? 1,
          variantLabel: currentVariant?.label ?? "A",
          promptHint: aiPromptHint,
        }),
      });
      const data = await res.json();
      if (data.subject && data.body) {
        setAiGeneratedResult({ subject: data.subject, body: data.body });
      }
    } finally {
      setGeneratingAi(false);
    }
  }

  function applyAiResult() {
    if (!aiGeneratedResult) return;
    updateCurrentVariant({
      subject: aiGeneratedResult.subject,
      body: aiGeneratedResult.body,
    });
    setShowAiModal(false);
    setAiGeneratedResult(null);
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      if (onSave) await onSave(steps);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[580px]">
      {/* LEFT COLUMN: Steps & Variants (4 cols) */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {steps.map((s, stepIdx) => (
          <div
            key={s.step}
            className={[
              "rounded-xl border p-3 flex flex-col gap-3 transition-colors",
              selectedStepIdx === stepIdx
                ? "border-[#0066FF] bg-[#12161F]"
                : "border-[#1E2433] bg-[#0E121B]",
            ].join(" ")}
          >
            {/* Step Header */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] font-semibold text-fg-1">
                Step {s.step} {s.step > 1 && `(Wait ${s.waitDays}d)`}
              </span>
              {s.step > 1 && (
                <div className="flex items-center gap-1 font-mono text-[11px] text-[#8A94A6]">
                  <span>Wait</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={s.waitDays}
                    onChange={(e) => {
                      const next = [...steps];
                      next[stepIdx].waitDays = parseInt(e.target.value, 10) || 1;
                      setSteps(next);
                    }}
                    className="w-12 bg-[#0E121B] border border-[#1E2433] rounded text-center text-fg-1 text-[11px]"
                  />
                  <span>days</span>
                </div>
              )}
            </div>

            {/* Variants List */}
            <div className="flex flex-col gap-2">
              {s.variants.map((v, vIdx) => {
                const isSelected = selectedStepIdx === stepIdx && selectedVariantIdx === vIdx;
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSelectedStepIdx(stepIdx);
                      setSelectedVariantIdx(vIdx);
                    }}
                    className={[
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                      isSelected
                        ? "border-[#0066FF] bg-[#1E2433]"
                        : "border-[#1E2433] bg-[#0E121B] hover:border-[#2D364D]",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-6 h-6 rounded-full bg-[#0066FF]/20 text-[#3385FF] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                        {v.label}
                      </span>
                      <p className="font-mono text-[11px] text-fg-2 truncate m-0 flex-1">
                        {v.subject || "Untitled variant"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Active toggle */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleVariant(stepIdx, vIdx);
                        }}
                        className={[
                          "w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer",
                          v.enabled ? "bg-[#0066FF]" : "bg-[#1E2433]",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "w-3 h-3 rounded-full bg-white transition-transform",
                            v.enabled ? "translate-x-3" : "translate-x-0",
                          ].join(" ")}
                        />
                      </button>

                      {/* Trash */}
                      {s.variants.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVariant(stepIdx, vIdx);
                          }}
                          className="text-[#566175] hover:text-red-400 text-[12px] p-1 cursor-pointer"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Variant button */}
            <button
              type="button"
              onClick={() => handleAddVariant(stepIdx)}
              className="font-mono text-[11px] text-[#3385FF] hover:text-[#0066FF] flex items-center justify-center gap-1.5 py-1.5 cursor-pointer"
            >
              <span>+</span> Add variant
            </button>
          </div>
        ))}

        {/* Add Step button */}
        <button
          type="button"
          onClick={handleAddStep}
          className="w-full border border-dashed border-[#1E2433] hover:border-[#3385FF] rounded-xl py-3 font-mono text-[12px] text-fg-3 hover:text-fg-1 flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span>+</span> Add step
        </button>
      </div>

      {/* RIGHT COLUMN: Subject & Body Editor (8 cols) */}
      <div className="lg:col-span-8 bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col justify-between">
        <div className="flex flex-col gap-4">
          {/* Top Bar inside Editor */}
          <div className="flex items-center justify-between border-b border-[#1E2433] pb-3">
            <div className="flex items-center gap-2 flex-1 mr-3">
              <span className="font-mono text-[12px] text-[#8A94A6] shrink-0">Subject</span>
              <Input
                value={currentVariant?.subject ?? ""}
                onChange={(e) => updateCurrentVariant({ subject: e.target.value })}
                placeholder="e.g. {{firstname}}, a thought for {{companyname}}"
                disabled={disabled}
                className="flex-1 bg-[#0E121B] border-[#1E2433] text-[13px]"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E2433] bg-[#0E121B] font-mono text-[11px] text-fg-3 hover:text-fg-1 cursor-pointer"
              >
                👁 Preview
              </button>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0066FF]/40 bg-[#0066FF]/10 text-[#3385FF] font-mono text-[11px] font-semibold hover:border-[#0066FF] cursor-pointer"
                title="AI Gemini Writer"
              >
                ⚡ AI Writer
              </button>
            </div>
          </div>

          {/* Template Variables Bar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] text-[#8A94A6] uppercase tracking-wider">Insert Tag:</span>
            {["firstname", "companyname", "website", "category"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertVariable(tag)}
                className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#1E2433] border border-[#2D364D] text-[#3385FF] hover:border-[#3385FF] cursor-pointer"
              >
                {`{{${tag}}}`}
              </button>
            ))}
          </div>

          {/* Rich Body Textarea */}
          <textarea
            value={currentVariant?.body ?? ""}
            onChange={(e) => updateCurrentVariant({ body: e.target.value })}
            placeholder="Write your email body template..."
            rows={14}
            disabled={disabled}
            className="w-full bg-[#0E121B] border border-[#1E2433] rounded-xl p-4 font-sans text-[13px] text-fg-1 leading-relaxed focus:outline-none focus:border-[#0066FF] resize-none"
          />
        </div>

        {/* Bottom Editor Toolbar */}
        <div className="flex items-center justify-between border-t border-[#1E2433] pt-4 mt-4">
          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || disabled}
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white px-5 py-2 rounded-lg font-mono text-[12px]"
          >
            {saving ? "Saving..." : "Save ⌄"}
          </Button>

          <div className="flex items-center gap-3 font-mono text-[12px] text-[#8A94A6]">
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="text-[#3385FF] hover:text-white cursor-pointer font-semibold"
              title="AI Gemini Writer"
            >
              ⚡ AI Writer
            </button>
            <button
              type="button"
              onClick={() => insertVariable("companyname")}
              className="hover:text-fg-1 cursor-pointer"
              title="Insert Variable"
            >
              {`{ }`}
            </button>
            <button type="button" className="hover:text-fg-1 cursor-pointer" title="Formatting">
              A:
            </button>
            <button type="button" className="hover:text-fg-1 cursor-pointer" title="Signature">
              ✍️
            </button>
            <button type="button" className="hover:text-fg-1 cursor-pointer" title="Insert Link">
              🔗
            </button>
            <button type="button" className="hover:text-fg-1 cursor-pointer" title="Code view">
              {`<>`}
            </button>
          </div>
        </div>
      </div>

      {/* AI Gemini Copy Writer Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 max-w-lg w-full flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#1E2433] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <h3 className="font-mono text-[14px] font-semibold text-fg-1 m-0">AI Gemini Email Writer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="text-fg-4 hover:text-fg-1 font-mono text-[14px]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 font-mono text-[12px]">
              <div>
                <label className="text-[#8A94A6] mb-1 block">Custom Instructions / Angles (Optional):</label>
                <Input
                  value={aiPromptHint}
                  onChange={(e) => setAiPromptHint(e.target.value)}
                  placeholder="e.g. Focus on 60-second response time, low friction CTA"
                  className="bg-[#0E121B] border-[#1E2433]"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateAiDraft}
                disabled={generatingAi}
                className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white py-2 rounded-lg font-mono font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {generatingAi ? "Generating copy with Gemini..." : "⚡ Generate Sequence Copy"}
              </button>

              {aiGeneratedResult && (
                <div className="flex flex-col gap-3 mt-2 p-3 rounded-lg border border-[#0066FF]/40 bg-[#0E121B]">
                  <div>
                    <span className="text-[#8A94A6] text-[11px] block">Generated Subject:</span>
                    <p className="font-semibold text-fg-1 m-0 mt-0.5">{aiGeneratedResult.subject}</p>
                  </div>
                  <div>
                    <span className="text-[#8A94A6] text-[11px] block">Generated Body:</span>
                    <p className="text-fg-2 m-0 mt-0.5 whitespace-pre-wrap font-sans text-[12px]">
                      {aiGeneratedResult.body}
                    </p>
                  </div>

                  <Button type="button" onClick={applyAiResult} className="mt-2 bg-[#10B981] hover:bg-[#059669]">
                    ✓ Apply to Variant {currentVariant?.label}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Sample Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 max-w-lg w-full flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#1E2433] pb-3">
              <h3 className="font-mono text-[14px] font-semibold text-fg-1 m-0">👁 Sample Lead Preview</h3>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-fg-4 hover:text-fg-1 font-mono text-[14px]"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 font-mono text-[12px]">
              <p className="text-[#8A94A6] m-0">
                To: <span className="text-fg-1">john@acmepest.com</span>
              </p>
              <p className="text-[#8A94A6] m-0 font-semibold">
                Subject:{" "}
                <span className="text-fg-1">
                  {(currentVariant?.subject ?? "")
                    .replace(/{{firstname}}/gi, "John")
                    .replace(/{{companyname}}/gi, "Acme Pest Control")}
                </span>
              </p>
            </div>

            <div className="border border-[#1E2433] bg-[#0E121B] rounded-lg p-4 font-sans text-[13px] text-fg-2 whitespace-pre-wrap leading-relaxed">
              {(currentVariant?.body ?? "")
                .replace(/{{firstname}}/gi, "John")
                .replace(/{{companyname}}/gi, "Acme Pest Control")
                .replace(/{{website}}/gi, "acmepest.com")
                .replace(/{{category}}/gi, "Speed-to-Lead AI")}
            </div>

            <Button type="button" onClick={() => setShowPreviewModal(false)} className="mt-2">
              Close Preview
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
