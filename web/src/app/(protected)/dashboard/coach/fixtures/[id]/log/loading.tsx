import { Skeleton } from "@/components/ui/skeleton";

/** The result form: a title, the score boxes, then the problem and notes fields. */
export default function LogResultLoading() {
  return (
    <output className="block max-w-2xl space-y-6" aria-label="Loading the result form">
      <Skeleton className="h-8 w-40" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-20 rounded-xl" />
        <Skeleton className="h-14 w-20 rounded-xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-11 w-36 rounded-md" />
    </output>
  );
}
