import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Every top-level route not listed here is treated as protected by default
// (see the redirect below) — the one way this list causes a real bug is a
// genuinely public page missing from it, which then wrongly bounces a
// logged-out visitor to login instead of rendering (this happened to
// `/offline`). `/register-club` was found the same way: a brand new visitor
// with no session at all could never reach the self-service academy signup
// page without this entry, silently defeating the whole feature.
// "/auth/verify" was an Expo-app OTP leftover — that route doesn't exist in
// this app (no page ever rendered there), so it was dead weight here.
const PUBLIC_PATHS = ["/auth/login", "/auth/role", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/", "/passport", "/offline", "/register-club"];

// Rate limiting: in-memory per process instance until UPSTASH_REDIS_REST_URL
// / UPSTASH_REDIS_REST_TOKEN are set, at which point lib/rate-limit.ts
// switches to a shared Redis-backed limiter with no code change here. See
// that file for why this matters on a serverless deployment: each instance
// otherwise keeps its own counter, so the real ceiling is `max` times
// however many instances happen to be warm.
const AUTH_RATE_LIMIT = { windowMs: 60_000, max: 10 };
// /auth/register now calls peek_access_code before signUp — rate limit it
// alongside login so a code can't be brute-forced through the register form.
const AUTH_PATHS = ["/auth/login", "/auth/register"];

export async function proxy(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const { maxAge: _, ...sessionOnlyOptions } = options ?? {};
            supabaseResponse.cookies.set(name, value, sessionOnlyOptions);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const { allowed, retryAfterMs } = await checkRateLimit({
      key: `auth:${ip}`,
      windowMs: AUTH_RATE_LIMIT.windowMs,
      max: AUTH_RATE_LIMIT.max,
    });
    if (!allowed) {
      const retrySeconds = Math.max(1, Math.ceil((retryAfterMs ?? AUTH_RATE_LIMIT.windowMs) / 1000));
      return new NextResponse("Too many requests", {
        status: 429,
        headers: { "Retry-After": String(retrySeconds) },
      });
    }
  }
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico";

  if (!user && !isPublic) {
    const loginUrl = new URL("/auth/login", request.url);
    // Lets a page like /join/[code] send an already-registered but
    // logged-out visitor back to the action they came for, instead of
    // dropping them at their generic dashboard after signing in.
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)"],
};
