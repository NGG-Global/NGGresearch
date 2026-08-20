import { MetricStripSkeleton } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/primitives';

/** Skeleton shown while a server component streams in. */
export default function Loading() {
  return (
    <div>
      <div className="border-b border-hair bg-surface px-6 py-3.5 lg:px-8">
        <div className="flex items-center gap-3">
          <Skeleton className="size-[34px] rounded-full" />
          <Skeleton className="h-4 w-28" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-32 rounded-[6px]" />
        </div>
      </div>

      <div className="space-y-4 border-b border-line px-6 py-7 lg:px-8">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-10 w-28 rounded-[7px]" />
      </div>

      <MetricStripSkeleton />
    </div>
  );
}
