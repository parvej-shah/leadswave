import { Skeleton } from "@/components/ui";

/** Server-navigation fallback for every dashboard page. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
