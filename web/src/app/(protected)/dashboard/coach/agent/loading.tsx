import { Skeleton } from "@/components/ui/skeleton";

export default function CoachAgentLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
