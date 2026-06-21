"use client";

import * as React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui";

/**
 * Reusable rich-text editor (Tiptap). Single source of truth for every compose
 * surface: signature (settings), inbox reply, lead-detail compose, WhatsApp.
 *
 * Controlled by HTML `value`. `onChange` hands back BOTH representations so
 * callers can persist the canonical plain text alongside the HTML (see
 * Message.body vs Message.bodyHtml). WhatsApp uses only the `text` argument
 * since click-to-chat can't carry markup.
 */
export type RichTextEditorProps = {
  value: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  /** Trim the toolbar to inline marks only (e.g. WhatsApp). */
  minimal?: boolean;
  className?: string;
  editorClassName?: string;
};

type ToolButton = {
  icon: IconName;
  title: string;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
};

const INLINE_TOOLS: ToolButton[] = [
  { icon: "bold", title: "Bold", isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { icon: "italic", title: "Italic", isActive: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
  { icon: "strikethrough", title: "Strikethrough", isActive: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
];

const BLOCK_TOOLS: ToolButton[] = [
  { icon: "list", title: "Bullet list", isActive: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
  { icon: "list-ordered", title: "Numbered list", isActive: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { icon: "quote", title: "Quote", isActive: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  label,
  hint,
  minimal = false,
  className,
  editorClassName,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: minimal ? false : { levels: [1, 2, 3] } })],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "rte-content min-h-[120px] w-full px-3 py-2.5 text-fg-2 font-mono text-[12.5px] leading-[1.6] outline-none",
          editorClassName,
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html, editor.getText());
    },
  });

  // Keep the editor in sync when the value is replaced externally (e.g. an AI
  // draft is loaded into the composer) without clobbering active typing.
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  const tools = minimal ? INLINE_TOOLS : [...INLINE_TOOLS, ...BLOCK_TOOLS];

  return (
    <div className={cn("flex flex-col", className)}>
      {label && (
        <span className="block mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-fg-4">
          {label}
        </span>
      )}
      <div className="w-full box-border bg-[oklch(0.13_0_0)] border border-[oklch(0.22_0_0)] focus-within:border-amber rounded-md overflow-hidden transition-colors duration-150">
        <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-[oklch(0.2_0_0)]">
          {tools.map((t, i) => (
            <button
              key={t.icon}
              type="button"
              title={t.title}
              aria-pressed={editor ? t.isActive(editor) : false}
              onClick={() => editor && t.run(editor)}
              className={cn(
                "flex items-center justify-center h-6 w-6 rounded text-fg-4 hover:text-fg-2 hover:bg-[oklch(0.18_0_0)] transition-colors",
                editor && t.isActive(editor) && "text-amber bg-[oklch(0.18_0_0)]",
                // visual divider before block tools
                !minimal && i === INLINE_TOOLS.length && "ml-1 border-l border-[oklch(0.2_0_0)] pl-1.5 w-auto px-1",
              )}
            >
              <Icon name={t.icon} className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <div className="relative">
          {editor?.isEmpty && placeholder && (
            <span className="pointer-events-none absolute left-3 top-2.5 font-mono text-[12.5px] text-fg-4 select-none">
              {placeholder}
            </span>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
      {hint && <p className="mt-1.5 font-mono text-[11px] text-fg-4">{hint}</p>}
    </div>
  );
}
