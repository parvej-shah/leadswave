import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button, EmptyState } from "@/components/ui";
import { getBusinessTypeStats } from "@/lib/business-type-stats";
import { TypeCard } from "./type-card";

export default async function BusinessTypesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = session.orgId;
  if (!orgId) redirect("/login");

  const stats = await getBusinessTypeStats(orgId);
  const totalCampaigns = stats.reduce((n, s) => n + s.campaignCount, 0);
  const totalLeads = stats.reduce((n, s) => n + s.leads, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="ds-h1 m-0 mb-1">Business Types</h1>
          <p className="font-mono text-[12px] text-fg-4 m-0">
            {stats.length} type{stats.length === 1 ? "" : "s"} ·{" "}
            <span className="text-fg-2">{totalCampaigns}</span> campaigns ·{" "}
            <span className="text-fg-2">{totalLeads}</span> leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/map">
            <Button variant="secondary" iconStart="map">Coverage map</Button>
          </Link>
          <Link href="/campaigns/new">
            <Button iconStart="plus">New Campaign</Button>
          </Link>
        </div>
      </div>

      {stats.length === 0 ? (
        <EmptyState action={{ label: "Launch your first campaign →", href: "/campaigns/new" }}>
          No business types yet. They're created automatically when you set a business type on a campaign.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {stats.map((s) => (
            <TypeCard key={s.id} stat={s} />
          ))}
        </div>
      )}
    </div>
  );
}
