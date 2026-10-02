// How long a sign-in lasts.
//
// Sign-ins used to be session-only: the server stripped `maxAge` from every
// Supabase auth cookie, so a coach or parent was signed out each time the
// browser closed, which on a phone is often. Players are children who may use
// a shared or family device, so they stay session-only.
//
// The role is known at sign-in but not where cookies are refreshed (the proxy
// and server client), so the login form leaves a small marker cookie and the
// refresh code reads it. The marker holds no identity, only "this person keeps
// their sign-in", and is overwritten on every sign-in.

import type { UserRole } from "@/lib/types";

type RoleLike = UserRole | string | null | undefined;

export const KEEP_SIGNED_IN_COOKIE = "gf-keep-signed-in";
/** About 30 days. */
export const KEEP_SIGNED_IN_SECONDS = 30 * 24 * 60 * 60;

export function keepsSignedIn(role: RoleLike): boolean {
  return role === "admin" || role === "coach" || role === "parent";
}

type CookieOptions = Record<string, unknown> & { maxAge?: number };

/** The options an auth cookie is written with: 30 days for people who keep their sign-in, session-only for everyone else. */
export function authCookieOptions(options: CookieOptions | undefined, keep: boolean): CookieOptions {
  const { maxAge: _ignored, ...rest } = options ?? {};
  return keep ? { ...rest, maxAge: KEEP_SIGNED_IN_SECONDS } : rest;
}

/** The marker cookie for `document.cookie`, set on sign-in. */
export function keepSignedInCookieString(role: RoleLike): string {
  const keep = keepsSignedIn(role);
  const base = `${KEEP_SIGNED_IN_COOKIE}=${keep ? "1" : "0"}; path=/; samesite=lax`;
  return keep ? `${base}; max-age=${KEEP_SIGNED_IN_SECONDS}` : base;
}

/** Browser only: record on this device whether the person who just signed in keeps their sign-in. */
export function rememberSignIn(role: RoleLike): void {
  document.cookie = keepSignedInCookieString(role);
}

/** Browser only: forget it on sign-out. */
export function forgetSignIn(): void {
  document.cookie = `${KEEP_SIGNED_IN_COOKIE}=0; path=/; samesite=lax; max-age=0`;
}
