import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CoverageMapClient } from "./coverage-map-client";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string; businessTypeId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.orgId) redirect("/login");
  const { campaignId, businessTypeId } = await searchParams;

  return (
    <div className="flex flex-col gap-4 -m-4 md:-m-6 p-4 md:p-6">
      <div>
        <h1 className="ds-h1 m-0 mb-1">Coverage Map</h1>
        <p className="font-mono text-[12px] text-fg-4 m-0">
          Where your leads are, how much of the world you've scouted, and what's still untouched.
        </p>
      </div>
      <CoverageMapClient campaignId={campaignId} businessTypeId={businessTypeId} />
    </div>
  );
}
