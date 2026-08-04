import { Skeleton } from "@/components/ui";

export default function CampaignDetailLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy>
      {/* Campaign Header Skeleton */}
      <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64 bg-[#1E2433] rounded-lg" />
          <Skeleton className="h-4 w-96 bg-[#1E2433] rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32 bg-[#0066FF]/20 rounded-xl" />
          <Skeleton className="h-10 w-28 bg-[#1E2433] rounded-xl" />
        </div>
      </div>

      {/* 6 Tab Bar Skeleton */}
      <div className="flex items-center gap-2 border-b border-[#1E2433] pb-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 bg-[#1E2433] rounded-lg" />
        ))}
      </div>

      {/* Top 5 Metrics Row Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 bg-[#12161F] border border-[#1E2433] rounded-xl" />
        ))}
      </div>

      {/* Main Table / Component Skeleton */}
      <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col gap-3">
        <Skeleton className="h-10 w-full bg-[#1E2433] rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-[#1E2433] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
