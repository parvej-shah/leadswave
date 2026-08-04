import { Skeleton } from "@/components/ui";

export default function InboxLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy>
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-44 bg-[#1E2433] rounded-lg" />
          <Skeleton className="h-4 w-72 bg-[#1E2433] rounded-md" />
        </div>
        <Skeleton className="h-10 w-48 bg-[#1E2433] rounded-xl" />
      </div>

      {/* 2-Column Inbox Layout Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[500px]">
        <div className="lg:col-span-5 flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 bg-[#12161F] border border-[#1E2433] rounded-xl" />
          ))}
        </div>
        <div className="lg:col-span-7 bg-[#12161F] border border-[#1E2433] rounded-xl p-5 flex flex-col gap-4">
          <Skeleton className="h-12 w-full bg-[#1E2433] rounded-lg" />
          <Skeleton className="h-40 w-full bg-[#1E2433] rounded-lg" />
          <Skeleton className="h-24 w-full bg-[#1E2433] rounded-lg" />
        </div>
      </div>
    </div>
  );
}
