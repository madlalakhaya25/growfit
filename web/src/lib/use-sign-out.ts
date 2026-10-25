"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { forgetSignIn } from "@/lib/auth-cookies";
import { clearLocalData } from "@/lib/clear-local-data";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";

/**
 * Signs out and clears what this device holds. Shared by the desktop sidebar
 * and the Account card on every settings page (the phone header no longer
 * carries a sign-out button: at 390 px it pushed the header past the screen).
 */
export function useSignOut() {
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clear);
  const [isSigningOut, startSignOut] = useTransition();

  function signOut() {
    startSignOut(async () => {
      await createClient().auth.signOut();
      // Forget that this device keeps its sign-in (lib/auth-cookies.ts).
      forgetSignIn();
      clearAuth();
      // Children's data held on this device (offline queue, drafts, cached pages).
      await clearLocalData().catch(() => {});
      router.push("/auth/login");
    });
  }

  return { signOut, isSigningOut };
}
