import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // A handful of call sites already used a leading underscore as the
    // conventional "I have to name this to destructure past it, but I
    // deliberately don't use it" marker (`const { maxAge: _, ...rest } =
    // options` to strip a cookie field; `{ teamId: _teamId }` to keep a
    // prop in a type without using it internally) — but nothing told
    // ESLint that convention existed, so it flagged them as plain unused
    // vars indistinguishable from an accidental one. This makes the
    // existing convention official rather than adding a new one.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
