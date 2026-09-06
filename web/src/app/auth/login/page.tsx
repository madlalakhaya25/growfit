export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><span className="text-muted-foreground text-sm">Loading…</span></div>}>
      <LoginForm />
    </Suspense>
  );
}
