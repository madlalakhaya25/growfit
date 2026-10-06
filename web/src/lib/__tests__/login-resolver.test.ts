/**
 * The sign-in form's resolver must agree with `loginSchema` (the rules the
 * server side and older code still use): same pass and fail on the same input,
 * same messages. What is tested: it matches the schema across typical inputs,
 * and trims the email it hands back.
 */
import { loginResolver } from "../login-resolver";
import { loginSchema } from "../validation";

const run = (values: { email: string; password: string }) =>
  loginResolver(values, undefined, { fields: {}, shouldUseNativeValidation: false });

const cases: { email: string; password: string }[] = [
  { email: "coach@growfit.co.za", password: "secret1" },
  { email: "  coach@growfit.co.za ", password: "secret1" },
  { email: "", password: "" },
  { email: "not-an-email", password: "secret1" },
  { email: "a@b", password: "secret1" },
  { email: "coach@growfit.co.za", password: "short" },
  { email: "coach@growfit.co.za", password: "123456" },
  { email: "bad", password: "x" },
];

describe("loginResolver agrees with loginSchema", () => {
  it.each(cases)("%j", async (input) => {
    const res = await run(input);
    const schema = loginSchema.safeParse({ ...input, email: input.email.trim() });
    expect(Object.keys(res.errors).length === 0).toBe(schema.success);
    if (!schema.success) {
      for (const issue of schema.error.issues) {
        const field = issue.path[0] as "email" | "password";
        expect(res.errors[field]?.message).toBe(issue.message);
      }
    }
  });

  it("returns the trimmed email on success", async () => {
    expect((await run({ email: "  a@b.co ", password: "secret1" })).values).toEqual({ email: "a@b.co", password: "secret1" });
  });
});
