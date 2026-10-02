import { Type } from "@google/genai";

/**
 * Gemini responseSchema for a SessionPlanStructured. Shared by every generator
 * that writes one (the session generator and the board-to-session progression)
 * so the shape lives in one place. Kept apart from session-plan.ts so Jest can
 * test that file without importing @google/genai.
 */
export const SESSION_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    drills: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          durationMinutes: { type: Type.NUMBER },
          ltpdFocus: { type: Type.STRING },
          fourCorner: { type: Type.STRING },
          setup: { type: Type.STRING },
          instructions: { type: Type.STRING },
          coachingPoints: { type: Type.STRING },
        },
        required: ["name", "durationMinutes", "ltpdFocus", "fourCorner", "setup", "instructions", "coachingPoints"],
      },
    },
    coachReflection: { type: Type.STRING },
  },
  required: ["drills", "coachReflection"],
};
