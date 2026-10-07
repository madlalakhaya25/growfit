import Image from "next/image";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/academy-brand";

/**
 * The mark and the name. Signed out (login, register) it says "Growfit".
 * Inside the app an academy passes its own `name`, and "Powered by Growfit"
 * sits beneath it, so a club's parents see their club's app.
 */
export function Logo({ className, name }: Readonly<{ className?: string; name?: string | null }>) {
  const own = name && name !== APP_NAME ? name : null;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {/* The source file is 52 KB for a 32 px mark; next/image serves a right-sized copy. */}
      <Image src="/growfit.png" alt={own ?? APP_NAME} width={32} height={32} priority className="shrink-0 rounded-sm" />
      <span className="min-w-0">
        <span className="block truncate text-lg font-bold leading-tight tracking-tight">{own ?? APP_NAME}</span>
        {own && <span className="block text-xs leading-tight text-muted-foreground">Powered by {APP_NAME}</span>}
      </span>
    </span>
  );
}
