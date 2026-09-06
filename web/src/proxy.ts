import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Every top-level route not listed here is treated as protected by default
// (see the redirect below) — the one way this list causes a real bug is a
// genuinely public page missing from it, which then wrongly bounces a
// logged-out visitor to login instead of rendering (this happened to
// `/offline`). `/register-club` was found the same way: a brand new visitor
// with no session at all could never reach the self-service academy signup
// page without this entry, silently defeating the whole feature.
const PUBLIC_PATHS = ["/auth/login", "/auth/verify", "/auth/role", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/", "/passport", "/offline", "/register-club"];

// Simple in-memory rate limiter (per process instance)
// For multi-instance deployments, replace with a shared store like Upstash Redis
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT = { windowMs: 60_000, max: 10 };
const AUTH_PATHS = ["/auth/login", "/auth/verify"];

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + AUTH_RATE_LIMIT.windowMs });
    return false;
  }
  if (entry.count >= AUTH_RATE_LIMIT.max) return true;
  entry.count++;
  return false;
}

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
    if (isRateLimited(ip)) {
      return new NextResponse("Too many requests", {
        status: 429,
        headers: { "Retry-After": "60" },
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
