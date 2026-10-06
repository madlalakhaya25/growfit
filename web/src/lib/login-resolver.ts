// The sign-in form's validation, without zod. Zod is about 50 KB gzipped and the
// login page is the first screen everyone sees on a phone, so this small resolver
// checks the same two things with the same messages as `loginSchema`
// (lib/validation.ts) and the page loads without the schema library.

import type { FieldErrors, Resolver } from "react-hook-form";
import type { LoginInput } from "@/lib/validation";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const loginResolver: Resolver<LoginInput> = async (values) => {
  const errors: FieldErrors<LoginInput> = {};
  const email = typeof values.email === "string" ? values.email.trim() : "";
  const password = typeof values.password === "string" ? values.password : "";

  if (!EMAIL.test(email)) errors.email = { type: "invalid_string", message: "Enter a valid email address" };
  if (password.length < 6) errors.password = { type: "too_small", message: "Enter your password" };

  if (Object.keys(errors).length > 0) return { values: {} as Record<string, never>, errors };
  return { values: { email, password }, errors: {} };
};
