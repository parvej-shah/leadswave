"use client";

import { useState } from "react";
import { Button, Dialog, Toast } from "@/components/ui";
import { RichTextEditor } from "@/components/rich-text-editor";
import { plainToHtml } from "@/lib/html/plain";

/**
 * WhatsApp outreach button: generates an offer-aware message for the lead
 * (AI-personalized, with a template fallback), lets the user edit it, then
 * opens WhatsApp click-to-chat with the message prefilled.
 */
export function WhatsAppButton({
  leadId,
  phone,
  companyName,
  label = "WA",
  className = "font-mono text-[11px] text-success hover:underline px-1 bg-transparent border-0 cursor-pointer",
}: {
  leadId: string;
  phone: string;
  companyName: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // `message` is the plain text used for the WhatsApp URL/clipboard (WhatsApp
  // can't render HTML); `messageHtml` drives the editor only.
  const [message, setMessage] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function openDialog(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setOpen(true);
    setError("");
    setCopied(false);
    setLoading(true);
    try {
      const res = await fetch("/api/leads/whatsapp-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to generate message");
      setMessage(data.message ?? "");
      setMessageHtml(plainToHtml(data.message ?? ""));
      if (data.generated === false) {
        setError(`AI unavailable (${data.reason ?? "unknown"}) — this is a template, edit before sending.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate message");
      const fallback = `Hi ${companyName} team! Would you be open to a quick chat?`;
      setMessage(fallback);
      setMessageHtml(plainToHtml(fallback));
    } finally {
      setLoading(false);
    }
  }

  function openWhatsApp() {
    const digits = phone.replace(/\D/g, "");
    // web.whatsapp.com directly (wa.me would try to open the desktop app first)
    window.open(
      `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`,
      "_blank"
    );
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        title="Generate a WhatsApp message with our offer"
        className={className}
      >
        {label}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="WhatsApp Message"
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button variant="secondary" onClick={copyMessage} disabled={!message || loading}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button onClick={openWhatsApp} disabled={!message || loading}>
              Open WhatsApp
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-sans text-[13px] text-fg-1 font-medium">{companyName}</span>
            <span className="font-mono text-[12px] text-fg-4">{phone}</span>
          </div>
          {error && (
            <Toast kind="hot" pill="NOTE">
              {error}
            </Toast>
          )}
          {loading ? (
            <p className="font-mono text-[12px] text-fg-4 m-0">writing message…</p>
          ) : (
            <RichTextEditor
              minimal
              value={messageHtml}
              onChange={(html, text) => {
                setMessageHtml(html);
                setMessage(text);
              }}
              hint="Edit freely — WhatsApp sends plain text, so formatting is for readability here only."
            />
          )}
        </div>
      </Dialog>
    </>
  );
}
