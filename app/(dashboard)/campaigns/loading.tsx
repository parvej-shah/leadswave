import { Skeleton } from "@/components/ui";

export default function CampaignsLoading() {
  return (
    <div className="flex flex-col gap-6 p-1 animate-pulse" aria-busy>
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48 bg-[#1E2433] rounded-lg" />
          <Skeleton className="h-4 w-72 bg-[#1E2433] rounded-md" />
        </div>
        <Skeleton className="h-10 w-36 bg-[#0066FF]/20 rounded-xl" />
      </div>

      {/* Campaign Cards Skeleton Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 bg-[#1E2433] rounded" />
              <Skeleton className="h-5 w-16 bg-[#1E2433] rounded-full" />
            </div>
            <Skeleton className="h-4 w-32 bg-[#1E2433] rounded" />
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1E2433]">
              <Skeleton className="h-8 w-full bg-[#1E2433] rounded-md" />
              <Skeleton className="h-8 w-full bg-[#1E2433] rounded-md" />
              <Skeleton className="h-8 w-full bg-[#1E2433] rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
