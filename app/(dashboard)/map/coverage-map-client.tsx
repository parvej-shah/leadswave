"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";

const CoverageMap = dynamic(() => import("@/components/coverage-map").then((m) => m.CoverageMap), {
  ssr: false,
  loading: () => <Skeleton className="w-full rounded-xl" style={{ height: "calc(100vh - 220px)" }} />,
});

export function CoverageMapClient(props: { campaignId?: string; businessTypeId?: string; compact?: boolean }) {
  return <CoverageMap {...props} />;
}
