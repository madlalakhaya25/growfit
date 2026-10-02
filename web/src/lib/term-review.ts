import type { MilestoneCategory } from "@/lib/development-categories";

/**
 * Term review: one band per development category per term.
 *
 * A band is a coach's judgement of where a child is in a category, in words,
 * not a number. Four bands, so nobody can sit safely in the middle, and none
 * of them is a failure.
 *
 * ## Who sees what
 *
 * Coaches see the band and what it means for the child's age group. Families
 * see growth since the previous term, in words, and never a score or a rank
 * against other children (`growthLine`).
 *
 * ## The descriptions are approved
 *
 * `BAND_DESCRIPTIONS` was written by Claude and approved by Buhle (technical
 * director) on 2026-10-02. If the wording is changed, set
 * `BAND_DESCRIPTIONS_APPROVED` back to false until it is approved again, and the
 * coach screen labels the bands as a draft.
 */

export type Band = 1 | 2 | 3 | 4;
export const BANDS: readonly Band[] = [1, 2, 3, 4];

export const BAND_LABELS: Record<Band, string> = {
  1: "Emerging",
  2: "Developing",
  3: "Secure",
  4: "Excelling",
};

export function isBand(value: unknown): value is Band {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export type AgeBracket = "U11" | "U13" | "U15";

/** U12 and below read as U11 wording, U13-U14 as U13, U15 and up as U15. Unknown reads as U13. */
export function ageBracket(ageGroup: string | null | undefined): AgeBracket {
  const n = Number(/^U(\d{1,2})$/i.exec((ageGroup ?? "").trim())?.[1]);
  if (!Number.isFinite(n)) return "U13";
  if (n <= 12) return "U11";
  if (n <= 14) return "U13";
  return "U15";
}

/** Buhle (technical director) approved the wording below on 2026-10-02. */
export const BAND_DESCRIPTIONS_APPROVED = true;

type Descriptions = Record<MilestoneCategory, Record<AgeBracket, Record<Band, string>>>;

export const BAND_DESCRIPTIONS: Descriptions = {
  technical: {
    U11: {
      1: "Still learning to control the ball. Touches are heavy and the ball often gets away.",
      2: "Controls the ball well when it is slow and nobody is close. Passes and shots are getting more accurate.",
      3: "Controls, passes and dribbles well with their better foot, and keeps the ball under a little pressure.",
      4: "Comfortable on both feet and keeps the ball with confidence, even with a defender close.",
    },
    U13: {
      1: "Basic control and passing are still inconsistent, especially when moving or under pressure.",
      2: "Good first touch and passing when there is time. Still loses it when closed down quickly.",
      3: "Reliable control, passing and dribbling in a match, and uses both feet in simple situations.",
      4: "Controls and passes accurately at speed and under pressure, and has a range of skills to beat a player.",
    },
    U15: {
      1: "Core skills break down in matches. First touch and passing accuracy need regular, focused work.",
      2: "Sound technique in training that does not always carry into the match when pressed.",
      3: "Consistent technique in matches, with a good first touch and accurate short and medium passing.",
      4: "Technique holds up at pace and under pressure, with a good range of passing, finishing and ball manipulation.",
    },
  },
  tactical: {
    U11: {
      1: "Still learning where to stand. Often chases the ball with everyone else.",
      2: "Knows their area and stays in it. Sometimes needs reminding when to attack and when to defend.",
      3: "Finds space, passes to a teammate in a better place, and gets back to help when the team loses the ball.",
      4: "Reads the game well for their age. Moves into space early and helps teammates find their positions.",
    },
    U13: {
      1: "Needs a lot of direction about position and role. Often out of shape when the ball changes sides.",
      2: "Understands their position and shape when instructed, and starts to recognise when to press or drop.",
      3: "Holds their position and moves with the team. Understands basic roles in attack and defence.",
      4: "Reads play early, adjusts position without being told, and can play more than one role well.",
    },
    U15: {
      1: "Struggles to follow the team's shape and role in a match, and is often caught out of position.",
      2: "Follows the team plan most of the time. Decisions slip when the match speeds up or the plan changes.",
      3: "Understands the plan and their role, and makes sound decisions in attack, defence and transition.",
      4: "Anticipates play, makes good decisions at pace, and helps organise others around them.",
    },
  },
  physical: {
    U11: {
      1: "Gets tired quickly and is still building balance and coordination.",
      2: "Moves well for short bursts. Is still building the energy to last a full match and good balance when turning.",
      3: "Runs, turns and jumps with good balance, and keeps going through the match.",
      4: "Quick, strong and well coordinated for their age, and finishes matches with energy to spare.",
    },
    U13: {
      1: "Fitness and coordination are well behind the group, or growth has made movement awkward for now.",
      2: "Handles training well. Pace, strength or stamina is still developing and fades late in matches.",
      3: "Good pace, strength and stamina for the level, and recovers well between efforts.",
      4: "A clear physical strength: speed, power or endurance that influences matches.",
    },
    U15: {
      1: "Physical base needs attention: stamina, strength or injury resilience limit them in matches.",
      2: "Copes with the demands of matches but fades late or struggles in duels against stronger players.",
      3: "Fit and robust for the level, with good pace and strength in matches and training.",
      4: "Stands out physically for the age group and sustains high intensity through the whole match.",
    },
  },
  mental: {
    U11: {
      1: "Gets upset or stops trying when things go wrong. Needs a lot of encouragement to keep going.",
      2: "Tries hard and listens. Sometimes gives up or gets upset after a mistake or a loss.",
      3: "Listens, tries again after a mistake, and enjoys training and matches.",
      4: "Brave and happy to try new things. Bounces back quickly and helps others feel good too.",
    },
    U13: {
      1: "Confidence is fragile. A mistake or a bad result can take them out of the whole session.",
      2: "Works hard and wants to improve. Still needs support to recover after setbacks.",
      3: "Focused and resilient. Takes feedback well and keeps going when it is tough.",
      4: "Mentally strong: calm under pressure, sets their own goals and learns quickly from mistakes.",
    },
    U15: {
      1: "Motivation or focus is inconsistent, and setbacks affect them for a long time.",
      2: "Committed most of the time. Concentration or confidence drops in big moments or after errors.",
      3: "Consistent in attitude and effort, takes feedback well and handles pressure sensibly.",
      4: "Composed and driven. Handles pressure, learns fast and sets a standard for how to prepare.",
    },
  },
  leadership: {
    U11: {
      1: "Mostly keeps to themselves, or finds it hard to wait their turn and share.",
      2: "Takes turns, follows the rules and is friendly with teammates.",
      3: "Encourages teammates and helps with equipment without being asked.",
      4: "Others look to them. Kind, fair and happy to help someone who is struggling.",
    },
    U13: {
      1: "Rarely speaks up or sometimes undermines the team. Needs reminding about respect.",
      2: "Respectful and reliable. Does not yet take the lead or speak up for others.",
      3: "Communicates with teammates, sets a good example and is on time and prepared.",
      4: "A natural role model. Organises others, encourages them and represents the academy well.",
    },
    U15: {
      1: "Does not yet take responsibility for their own conduct or for what the team needs.",
      2: "Reliable and respectful. Leads by example, but is not yet comfortable speaking up for the team.",
      3: "Takes responsibility, communicates clearly and supports teammates on and off the pitch.",
      4: "Leads naturally. Holds the group to a high standard and supports younger players.",
    },
  },
};

/** What a band means for a category at an age group. */
export function describeBand(category: MilestoneCategory, ageGroup: string | null | undefined, band: Band): string {
  return BAND_DESCRIPTIONS[category][ageBracket(ageGroup)][band];
}

export interface ReviewEntry {
  category: MilestoneCategory;
  band: Band;
}

export type Growth = "up" | "steady" | "building" | "first";

/**
 * How a category moved since the previous term. A drop is deliberately called
 * "building", not a decline: a child can be set back by a growth spurt or an
 * injury, and a family should hear about it from the coach, not a label.
 */
export function growthBetween(previous: Band | null | undefined, current: Band): Growth {
  if (!previous) return "first";
  if (current > previous) return "up";
  if (current === previous) return "steady";
  return "building";
}

/** The family-facing sentence for one category. Never a score. */
export function growthLine(label: string, previous: Band | null | undefined, current: Band): string {
  switch (growthBetween(previous, current)) {
    case "first":
      return `${label}: ${BAND_LABELS[current]} this term.`;
    case "up":
      return `${label}: moved up from ${BAND_LABELS[previous as Band]} to ${BAND_LABELS[current]}.`;
    case "steady":
      return `${label}: staying ${BAND_LABELS[current]}, and building on it.`;
    default:
      return `${label}: still building. Ask the coach how to help.`;
  }
}

/** Categories still unreviewed this term, in display order. */
export function unreviewed(done: ReviewEntry[], categories: readonly MilestoneCategory[]): MilestoneCategory[] {
  const have = new Set(done.map((d) => d.category));
  return categories.filter((c) => !have.has(c));
}
