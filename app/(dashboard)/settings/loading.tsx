import { Skeleton } from "@/components/ui";

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse max-w-4xl" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44 bg-[#1E2433] rounded-lg" />
        <Skeleton className="h-4 w-72 bg-[#1E2433] rounded-md" />
      </div>

      <div className="flex items-center gap-2 border-b border-[#1E2433] pb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 bg-[#1E2433] rounded-lg" />
        ))}
      </div>

      <div className="bg-[#12161F] border border-[#1E2433] rounded-xl p-6 flex flex-col gap-5">
        <Skeleton className="h-10 w-full bg-[#1E2433] rounded-lg" />
        <Skeleton className="h-10 w-full bg-[#1E2433] rounded-lg" />
        <Skeleton className="h-32 w-full bg-[#1E2433] rounded-lg" />
      </div>
    </div>
  );
}
