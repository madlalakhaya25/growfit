import { z } from 'zod';

export const registerSchema = z.object({
  full_name: z.string().min(2, 'Enter your full name'),
  phone: z
    .string()
    .min(9, 'Enter a valid phone number')
    .regex(/^(\+27|0)[6-8][0-9]{8}$/, 'Enter a valid South African number'),
  role: z.enum(['player', 'coach', 'parent'], { required_error: 'Choose a role' }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  phone: z
    .string()
    .min(9, 'Enter a valid phone number')
    .regex(/^(\+27|0)[6-8][0-9]{8}$/, 'Enter a valid South African number'),
});

export const otpSchema = z.object({
  token: z.string().length(6, 'OTP must be 6 digits'),
});

const attrField = z.number().int().min(0).max(100).optional();

export const createPlayerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  date_of_birth: z.string().optional(),
  position: z.enum(['goalkeeper', 'defender', 'midfielder', 'winger', 'striker']).optional(),
  secondary_pos: z
    .enum(['goalkeeper', 'defender', 'midfielder', 'winger', 'striker'])
    .optional()
    .nullable(),
  preferred_foot: z.enum(['left', 'right', 'both']).optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  pace:      attrField,
  shooting:  attrField,
  passing:   attrField,
  dribbling: attrField,
  defending: attrField,
  physical:  attrField,
});

export const createTeamSchema = z.object({
  name: z.string().min(2, 'Team name must be at least 2 characters'),
  age_group: z.string().optional(),
});

export const createFixtureSchema = z.object({
  opponent: z.string().min(2, 'Opponent name required'),
  venue: z.string().optional(),
  fixture_date: z.string().min(1, 'Date and time required'),
  is_home: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const logResultSchema = z.object({
  team_score: z.number().int().min(0).max(30),
  opponent_score: z.number().int().min(0).max(30),
  match_notes: z.string().max(500).optional(),
});

export const playerRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().max(200).optional(),
});

// A staff-issued, single-use child link code — 10 characters, distinct from
// the 6-character club/team access codes so the two cannot be confused. Mirrors
// web/src/lib/validation.ts's linkChildSchema (migration 032: linking a child
// no longer accepts the public share token).
export const linkChildSchema = z.object({
  code: z
    .string()
    .transform((raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .refine((code) => code.length === 10, "A child link code is 10 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type OtpInput = z.infer<typeof otpSchema>;
export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type CreateFixtureInput = z.infer<typeof createFixtureSchema>;
export type LogResultInput = z.infer<typeof logResultSchema>;
export type PlayerRatingInput = z.infer<typeof playerRatingSchema>;
export type LinkChildInput = z.infer<typeof linkChildSchema>;
