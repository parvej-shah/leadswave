import Link from "next/link";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Done" },
] as const;

export type StatusFilter = (typeof OPTIONS)[number]["value"];

export function StatusFilter({ current }: { current: StatusFilter }) {
  return (
    <div className="inline-flex p-0.5 rounded-md bg-[oklch(0.13_0_0)] border border-[oklch(0.20_0_0)] gap-px">
      {OPTIONS.map((o) => {
        const isActive = current === o.value;
        const href = o.value === "all" ? "/campaigns" : `/campaigns?status=${o.value}`;
        return (
          <Link
            key={o.value}
            href={href}
            className={cn(
              "font-mono uppercase tracking-[0.06em] text-[11px] px-2.5 py-[5px] rounded-[4px] transition-colors duration-150",
              isActive
                ? "bg-[oklch(0.18_0_0)] text-fg-1"
                : "bg-transparent text-fg-4 hover:text-fg-3"
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
