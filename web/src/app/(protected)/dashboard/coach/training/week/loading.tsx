import { Skeleton } from "@/components/ui/skeleton";

/** The week plan: a title, then a card for each day of training and matches. */
export default function WeekPlanLoading() {
  return (
    <output className="block space-y-6" aria-label="Loading the week plan">
      <Skeleton className="h-8 w-44" />
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    </output>
  );
}
