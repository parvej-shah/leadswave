"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Segmented } from "@/components/ui";

const OPTIONS = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "ytd", label: "YTD" },
] as const;

type Period = (typeof OPTIONS)[number]["value"];

export function DashboardPeriodSwitcher() {
  const router = useRouter();
  const params = useSearchParams();
  const period = (params.get("period") as Period) ?? "7d";

  function onChange(next: Period) {
    const url = new URL(window.location.href);
    url.searchParams.set("period", next);
    router.push(url.pathname + url.search);
  }

  return (
    <Segmented
      value={period}
      onChange={onChange}
      options={OPTIONS}
    />
  );
}
