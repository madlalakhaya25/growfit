// How the pitch is painted — separate from what it is (lib/board-model.ts's
// Pitch describes the markings). A theme only changes colours and finish, so
// every preset, play and overlay works on every theme unchanged.
//
//   classic    — matchday grass: mown stripes, fine blade texture, worn goalmouths
//   night      — the same pitch under floodlights: darker, with four light pools
//   chalkboard — the dressing-room board: slate, chalk lines, no grass
//   print      — white paper, dark lines: for printed handouts and PDFs

export type PitchThemeId = "classic" | "night" | "chalkboard" | "print";

export interface PitchTheme {
  id: PitchThemeId;
  label: string;
  /** Two alternating stripe colours (equal = no stripes). */
  stripes: [string, string];
  /** Blade-texture strength, 0 = none. */
  texture: number;
  /** Worn patches in the goalmouths and centre circle. */
  wear: boolean;
  lighting: "sun" | "floodlights" | "none";
  vignette: number;
  line: string;
  lineOpacity: number;
  /** A soft halo under the lines — chalk on grass isn't a vector edge. */
  lineGlow: number;
  net: string;
}

export const PITCH_THEMES: Record<PitchThemeId, PitchTheme> = {
  classic: {
    id: "classic", label: "Matchday",
    stripes: ["#2c9653", "#237f45"], texture: 0.5, wear: true, lighting: "sun", vignette: 0.3,
    line: "#ffffff", lineOpacity: 0.9, lineGlow: 0.12, net: "rgba(255,255,255,0.5)",
  },
  night: {
    id: "night", label: "Floodlit",
    stripes: ["#1c6b3a", "#175c31"], texture: 0.45, wear: true, lighting: "floodlights", vignette: 0.55,
    line: "#f8fafc", lineOpacity: 0.92, lineGlow: 0.2, net: "rgba(255,255,255,0.45)",
  },
  chalkboard: {
    id: "chalkboard", label: "Chalkboard",
    stripes: ["#26352d", "#26352d"], texture: 0.25, wear: false, lighting: "none", vignette: 0.35,
    line: "#e7efe9", lineOpacity: 0.75, lineGlow: 0.18, net: "rgba(231,239,233,0.35)",
  },
  print: {
    id: "print", label: "Print",
    stripes: ["#ffffff", "#ffffff"], texture: 0, wear: false, lighting: "none", vignette: 0,
    line: "#0f172a", lineOpacity: 0.85, lineGlow: 0, net: "rgba(15,23,42,0.35)",
  },
};

export const PITCH_THEME_LIST = Object.values(PITCH_THEMES);

export function getPitchTheme(id: string | undefined | null): PitchTheme {
  return (id && PITCH_THEMES[id as PitchThemeId]) || PITCH_THEMES.classic;
}
