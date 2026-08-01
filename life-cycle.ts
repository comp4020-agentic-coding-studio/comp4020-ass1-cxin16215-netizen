// Pure, DOM-free life-cycle logic: shared by main.ts (rendering) and
// spec/life-cycle.test.ts (unit tests), since the built page's JSDOM tests
// don't execute scripts.

export const STAGES = ["polyp", "young", "mature", "senescent"] as const;
export type Stage = (typeof STAGES)[number];

export interface StageParams {
  hueDeg: number;
  blurStd: number;
  displaceScale: number;
  scale: number;
  saturate: number;
}

export const KEYFRAME_PARAMS: Record<Stage, StageParams> = {
  polyp: { hueDeg: 0, blurStd: 2, displaceScale: 2, scale: 0.55, saturate: 1.0 },
  young: { hueDeg: 25, blurStd: 4, displaceScale: 4, scale: 0.8, saturate: 1.2 },
  mature: { hueDeg: 15, blurStd: 5, displaceScale: 5, scale: 1.0, saturate: 1.3 },
  senescent: { hueDeg: -40, blurStd: 2, displaceScale: 9, scale: 0.85, saturate: 0.6 },
};

export function ease(x: number): number {
  const clamped = Math.min(Math.max(x, 0), 1);
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}

// The next stage in the cycle -- wraps senescent back to polyp. This wrap is
// the whole mechanic: the button never says a loop is coming.
export function nextStage(stage: Stage): Stage {
  return STAGES[(STAGES.indexOf(stage) + 1) % STAGES.length];
}

// True only for the one transition that wraps the cycle, so the caller knows
// when to play the ouroboros flourish.
export function isLoopTransition(from: Stage, to: Stage): boolean {
  return from === STAGES[STAGES.length - 1] && to === STAGES[0];
}

// Interpolates a single visual parameter between two named stages, eased.
// Used to animate the button-triggered transition frame by frame.
export function blendParams(from: Stage, to: Stage, rawLocalT: number, param: keyof StageParams): number {
  const localT = ease(rawLocalT);
  const a = KEYFRAME_PARAMS[from][param];
  const b = KEYFRAME_PARAMS[to][param];
  return a + (b - a) * localT;
}

export interface StageInfo {
  label: string;
  caption: string;
  detail: string;
}

// Describes what each stage is, biologically -- never what happens between
// stages. The reset back to polyp stays undescribed; it's discovered, not read.
export const STAGE_INFO: Record<Stage, StageInfo> = {
  polyp: {
    label: "Polyp",
    caption: "Anchored to the seafloor, a colony of polyps buds slowly, waiting.",
    detail:
      "Turritopsis dohrnii begins life as a tiny polyp, a few millimetres tall, permanently attached to a hard " +
      "surface on the seafloor. Polyps bud asexually, forming small colonies that can persist for months before " +
      "releasing free-swimming medusae.",
  },
  young: {
    label: "Young medusa",
    caption: "Freed to drift, a small bell begins pulsing through open water.",
    detail:
      "Once released, the young medusa is only a few millimetres across. It pulses its bell to swim and starts " +
      "feeding on plankton, growing steadily larger over the days that follow.",
  },
  mature: {
    label: "Mature medusa",
    caption: "Full grown, oral arms trail and sting to feed, tentacles reaching wide.",
    detail:
      "A mature medusa can grow up to 4.5 millimetres in diameter, with as many as 90 tentacles and a bright red " +
      "stomach visible through its transparent bell. This is the reproductive stage of its life cycle.",
  },
  senescent: {
    label: "Senescent",
    caption: "Aging, the bell shrinks and frays -- tissue breaking down, drifting toward the seafloor.",
    detail:
      "Under stress, starvation, or old age, the medusa's tissue begins to deteriorate. In most jellyfish " +
      "species, this is the end of the line.",
  },
};
