import { z } from "zod";

/** Validation schemas — ported from the Expo app (framework-agnostic). */

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["player", "coach", "parent"], { error: "Choose a role" }),
  // Optional at the schema level — a player may continue without a code
  // (the "waiting to be added" state /auth/role also allows). Register.page
  // still requires it for coach/parent in the UI itself.
  club_code: z.string().length(6, "Code must be exactly 6 characters").optional().or(z.literal("")),
  // No `share_token` here any more. A parent used to link themselves to a
  // child during registration using the child's public share token; that path
  // is gone (migration 032) and linking happens from the dashboard with a
  // staff-issued code.
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string().min(1, "Confirm your password"),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ["confirm"],
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

const attrField = z.coerce.number().int().min(0).max(100).optional();

export const createPlayerSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  date_of_birth: z.string().optional(),
  position: z
    .enum(["goalkeeper", "defender", "midfielder", "winger", "striker"])
    .optional(),
  preferred_foot: z.enum(["left", "right", "both"]).optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  pace:      attrField,
  shooting:  attrField,
  passing:   attrField,
  dribbling: attrField,
  defending: attrField,
  physical:  attrField,
});

export const createTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters"),
  age_group: z.string().optional(),
});

export const createFixtureSchema = z.object({
  opponent: z.string().min(2, "Opponent name required"),
  venue: z.string().optional(),
  fixture_date: z.string().min(1, "Date and time required"),
  is_home: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const playerRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().max(200).optional(),
});

export const linkChildSchema = z.object({
  // A staff-issued, single-use child link code — 10 characters, distinct from
  // the 6-character club/team access codes so the two cannot be confused.
  code: z
    .string()
    .transform((raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .refine((code) => code.length === 10, "A child link code is 10 characters"),
});

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type CreateFixtureInput = z.infer<typeof createFixtureSchema>;
export type PlayerRatingInput = z.infer<typeof playerRatingSchema>;
export type LinkChildInput = z.infer<typeof linkChildSchema>;
