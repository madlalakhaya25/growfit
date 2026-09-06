import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/auth/login", "/auth/verify", "/auth/role", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/", "/passport", "/offline"];

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
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)"],
};
