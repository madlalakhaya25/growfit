"use client";

import { Loader2, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSignOut } from "@/lib/use-sign-out";

/** Appearance and sign-out: on a phone, the only place they live. */
export function AccountCard() {
  const { signOut, isSigningOut } = useSignOut();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Appearance and sign-out</CardTitle>
        <CardDescription>Light, dark, or follow this device.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <ThemeToggle showSystem />
        <Button variant="outline" size="sm" onClick={signOut} disabled={isSigningOut}>
          {isSigningOut ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
          {isSigningOut ? "Signing out…" : "Sign out"}
        </Button>
      </CardContent>
    </Card>
  );
}
