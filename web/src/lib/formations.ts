// Formation presets for the tactical board.
//
// Coordinates are in board space (100 wide x 150 tall) for the HOME team,
// which defends the bottom goal (y=150) and attacks upward toward y=0.
// Opponent shapes are derived by rotating these 180 degrees, so every preset
// is usable by both sides.
//
// `role` carries a position value from POSITIONS so the board can auto-assign
// real players to the slot that matches how they actually play.

export interface FormationSlot {
  x: number;
  y: number;
  role: string;
}
export interface Formation {
  id: string;
  label: string;
  /** Total players including the goalkeeper. */
  size: 5 | 7 | 9 | 11;
  /** Typical age bracket for this format, shown as a hint. */
  format: string;
  slots: FormationSlot[];
}

const s = (x: number, y: number, role: string): FormationSlot => ({ x, y, role });

export const FORMATIONS: Formation[] = [
  // ── 5-a-side (U7–U8) ──────────────────────────────────────────
  {
    id: "5-1-2-1", label: "1-2-1 (Diamond)", size: 5, format: "5-a-side · U7–U8",
    slots: [s(50, 142, "gk"), s(30, 112, "cb"), s(70, 112, "cb"), s(50, 84, "cm"), s(50, 50, "st")],
  },
  {
    id: "5-2-2", label: "2-2 (Box)", size: 5, format: "5-a-side · U7–U8",
    slots: [s(50, 142, "gk"), s(32, 114, "cb"), s(68, 114, "cb"), s(32, 68, "cm"), s(68, 68, "cm")],
  },

  // ── 7-a-side (U9–U10) ─────────────────────────────────────────
  {
    id: "7-2-3-1", label: "2-3-1", size: 7, format: "7-a-side · U9–U10",
    slots: [s(50, 142, "gk"), s(34, 118, "cb"), s(66, 118, "cb"), s(22, 86, "lm"), s(50, 90, "cm"), s(78, 86, "rm"), s(50, 44, "st")],
  },
  {
    id: "7-3-2-1", label: "3-2-1", size: 7, format: "7-a-side · U9–U10",
    slots: [s(50, 142, "gk"), s(26, 118, "lb"), s(50, 122, "cb"), s(74, 118, "rb"), s(36, 86, "cm"), s(64, 86, "cm"), s(50, 44, "st")],
  },
  {
    id: "7-2-1-2-1", label: "2-1-2-1", size: 7, format: "7-a-side · U9–U10",
    slots: [s(50, 142, "gk"), s(34, 120, "cb"), s(66, 120, "cb"), s(50, 100, "cdm"), s(26, 74, "lm"), s(74, 74, "rm"), s(50, 42, "st")],
  },

  // ── 9-a-side (U11–U12) ────────────────────────────────────────
  {
    id: "9-3-2-3", label: "3-2-3", size: 9, format: "9-a-side · U11–U12",
    slots: [s(50, 142, "gk"), s(24, 116, "lb"), s(50, 120, "cb"), s(76, 116, "rb"), s(34, 88, "cm"), s(66, 88, "cm"), s(22, 46, "lw"), s(50, 40, "st"), s(78, 46, "rw")],
  },
  {
    id: "9-3-3-2", label: "3-3-2", size: 9, format: "9-a-side · U11–U12",
    slots: [s(50, 142, "gk"), s(24, 116, "lb"), s(50, 120, "cb"), s(76, 116, "rb"), s(26, 86, "lm"), s(50, 90, "cm"), s(74, 86, "rm"), s(38, 44, "st"), s(62, 44, "st")],
  },
  {
    id: "9-2-4-2", label: "2-4-2", size: 9, format: "9-a-side · U11–U12",
    slots: [s(50, 142, "gk"), s(34, 118, "cb"), s(66, 118, "cb"), s(18, 86, "lm"), s(40, 90, "cm"), s(60, 90, "cm"), s(82, 86, "rm"), s(38, 44, "st"), s(62, 44, "st")],
  },

  // ── 11-a-side (U13+) ──────────────────────────────────────────
  {
    id: "11-4-4-2", label: "4-4-2", size: 11, format: "11-a-side · U13+",
    slots: [s(50, 142, "gk"), s(16, 116, "lb"), s(38, 120, "cb"), s(62, 120, "cb"), s(84, 116, "rb"), s(16, 84, "lm"), s(40, 88, "cm"), s(60, 88, "cm"), s(84, 84, "rm"), s(38, 42, "st"), s(62, 42, "st")],
  },
  {
    id: "11-4-3-3", label: "4-3-3", size: 11, format: "11-a-side · U13+",
    slots: [s(50, 142, "gk"), s(16, 116, "lb"), s(38, 120, "cb"), s(62, 120, "cb"), s(84, 116, "rb"), s(28, 86, "cm"), s(50, 92, "cdm"), s(72, 86, "cm"), s(22, 44, "lw"), s(50, 38, "st"), s(78, 44, "rw")],
  },
  {
    id: "11-4-2-3-1", label: "4-2-3-1", size: 11, format: "11-a-side · U13+",
    slots: [s(50, 142, "gk"), s(16, 116, "lb"), s(38, 120, "cb"), s(62, 120, "cb"), s(84, 116, "rb"), s(38, 96, "cdm"), s(62, 96, "cdm"), s(22, 66, "lw"), s(50, 62, "cam"), s(78, 66, "rw"), s(50, 38, "st")],
  },
  {
    id: "11-3-5-2", label: "3-5-2", size: 11, format: "11-a-side · U13+",
    slots: [s(50, 142, "gk"), s(28, 120, "cb"), s(50, 124, "cb"), s(72, 120, "cb"), s(14, 88, "lwb"), s(36, 92, "cm"), s(50, 96, "cdm"), s(64, 92, "cm"), s(86, 88, "rwb"), s(38, 44, "st"), s(62, 44, "st")],
  },
  {
    id: "11-5-3-2", label: "5-3-2", size: 11, format: "11-a-side · U13+",
    slots: [s(50, 142, "gk"), s(12, 110, "lwb"), s(30, 122, "cb"), s(50, 126, "cb"), s(70, 122, "cb"), s(88, 110, "rwb"), s(34, 88, "cm"), s(50, 92, "cm"), s(66, 88, "cm"), s(38, 46, "st"), s(62, 46, "st")],
  },
  {
    id: "11-4-1-4-1", label: "4-1-4-1", size: 11, format: "11-a-side · U13+",
    slots: [s(50, 142, "gk"), s(16, 116, "lb"), s(38, 120, "cb"), s(62, 120, "cb"), s(84, 116, "rb"), s(50, 98, "cdm"), s(18, 76, "lm"), s(40, 78, "cm"), s(60, 78, "cm"), s(82, 76, "rm"), s(50, 40, "st")],
  },
  {
    id: "11-3-4-3", label: "3-4-3", size: 11, format: "11-a-side · U13+",
    slots: [s(50, 142, "gk"), s(28, 120, "cb"), s(50, 124, "cb"), s(72, 120, "cb"), s(16, 88, "lm"), s(38, 92, "cm"), s(62, 92, "cm"), s(84, 88, "rm"), s(24, 46, "lw"), s(50, 40, "st"), s(76, 46, "rw")],
  },
  {
    id: "11-4-4-1-1", label: "4-4-1-1", size: 11, format: "11-a-side · U13+",
    slots: [s(50, 142, "gk"), s(16, 116, "lb"), s(38, 120, "cb"), s(62, 120, "cb"), s(84, 116, "rb"), s(16, 86, "lm"), s(40, 90, "cm"), s(60, 90, "cm"), s(84, 86, "rm"), s(50, 60, "ss"), s(50, 38, "st")],
  },
];

export const FORMATION_SIZES: Formation["size"][] = [5, 7, 9, 11];
