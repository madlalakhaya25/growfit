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

const num = { type: Type.NUMBER };

/**
 * The same plan with an optional pitch diagram on each drill (lib/drill-diagram.ts
 * validates it). Optional so a model that cannot draw a drill confidently can
 * leave the diagram out and still return a usable plan.
 */
export const SESSION_PLAN_WITH_DIAGRAMS_SCHEMA = {
  ...SESSION_PLAN_SCHEMA,
  properties: {
    ...SESSION_PLAN_SCHEMA.properties,
    drills: {
      ...SESSION_PLAN_SCHEMA.properties.drills,
      items: {
        ...SESSION_PLAN_SCHEMA.properties.drills.items,
        properties: {
          ...SESSION_PLAN_SCHEMA.properties.drills.items.properties,
          diagram: {
            type: Type.OBJECT,
            properties: {
              pitch: { type: Type.STRING, enum: ["grid-small", "grid-large", "half", "full"] },
              tokens: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { role: { type: Type.STRING, enum: ["team", "opponent", "keeper", "ball"] }, x: num, y: num },
                  required: ["role", "x", "y"],
                },
              },
              equipment: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    kind: {
                      type: Type.STRING,
                      enum: ["cone", "flat-marker", "mannequin", "mini-goal", "goal", "pole", "ladder", "hurdle", "ball-cluster", "bib"],
                    },
                    x: num, y: num, rotation: num,
                  },
                  required: ["kind", "x", "y"],
                },
              },
              moves: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    kind: { type: Type.STRING, enum: ["run", "pass", "dribble", "shot", "press"] },
                    from: num, toToken: num, x: num, y: num, curve: num,
                  },
                  required: ["kind", "from"],
                },
              },
              zones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    points: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { x: num, y: num }, required: ["x", "y"] } },
                    hatch: { type: Type.BOOLEAN },
                  },
                  required: ["points"],
                },
              },
            },
            required: ["pitch", "tokens"],
          },
        },
      },
    },
  },
};
