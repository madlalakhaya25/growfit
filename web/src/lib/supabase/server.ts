import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cached per request (React `cache()`, deduplicated the same way
 * `lib/auth.ts`'s `getProfile` already is) -- every Server Component/Action
 * in one request now shares the same client instance instead of each call
 * site building its own. `cookies()` was already request-scoped underneath,
 * so this changes nothing about freshness, only how many times an
 * equivalent client gets constructed. It also makes helpers that take this
 * client as an argument (`getCoachedTeamIds`) actually cacheable by
 * identity -- see that function's own comment.
 */
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Strip maxAge so cookies are session-only (cleared on browser close)
              const { maxAge: _, ...sessionOnlyOptions } = options ?? {};
              cookieStore.set(name, value, sessionOnlyOptions);
            });
          } catch {
            // setAll called from a Server Component — middleware handles refresh
          }
        },
      },
    }
  );
});
