import { APP_NAME } from "@/lib/academy-brand";

/** A quiet line for the foot of settings pages. */
export function PoweredByGrowfit() {
  return <p className="pt-2 text-center text-xs text-muted-foreground">Powered by {APP_NAME}</p>;
}
