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
  polyp: { hueDeg: 0, blurStd: 1.2, displaceScale: 2, scale: 0.92, saturate: 1.0 },
  young: { hueDeg: 25, blurStd: 2, displaceScale: 4, scale: 0.96, saturate: 1.15 },
  mature: { hueDeg: 15, blurStd: 2.4, displaceScale: 5, scale: 1.0, saturate: 1.25 },
  senescent: { hueDeg: -40, blurStd: 1.4, displaceScale: 8, scale: 0.94, saturate: 0.65 },
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
  image: string;
  imageAlt: string;
  specimen: string;
  specimenNote: string;
}

// Describes what each stage is, biologically -- never what happens between
// stages. The wrap back to polyp stays undescribed; it's discovered, not read.
// Reference images are AI-generated illustrations of real, well-documented
// hydrozoans used as visual stand-ins: clear photos of Turritopsis dohrnii at
// every stage are scarce, so each specimen is named honestly rather than
// presented as the same animal.
export const STAGE_INFO: Record<Stage, StageInfo> = {
  polyp: {
    label: "Polyp",
    caption: "Anchored to the seafloor, a colony of polyps buds slowly, waiting.",
    detail:
      "Turritopsis dohrnii — the lighthouse jellyfish — begins as a polyp only a few millimetres tall, " +
      "cemented to rock, shell, or wood on the seafloor. Like other hydrozoans it builds a small colony by " +
      "budding: each polyp shares a stolon network, and when conditions are right the colony releases " +
      "free-swimming medusae. This sessile phase is the quiet foundation of the whole life cycle — " +
      "easy to miss if you only picture a drifting bell.",
    image: "./assets/stages/polyp.png",
    imageAlt: "AI-generated illustration of an Obelia geniculata polyp colony on the seafloor",
    specimen: "Obelia geniculata",
    specimenNote:
      "T. dohrnii polyps are tinier and rarely photographed; Obelia shows the same anchored, " +
      "tentacle-crowned hydrozoan body plan.",
  },
  young: {
    label: "Young medusa",
    caption: "Freed to drift, a small bell begins pulsing through open water.",
    detail:
      "Once budded off the colony, a young T. dohrnii medusa is only a few millimetres across — smaller than " +
      "a pencil eraser. It swims by pulsing its bell, feeds on plankton, and grows day by day. At this age the " +
      "bell is nearly colourless; the trademark red stomach is only just beginning to show through. Hydrozoan " +
      "medusae this small are easy to overlook in open water, which is part of why the species stayed obscure " +
      "for so long.",
    image: "./assets/stages/young.png",
    imageAlt: "AI-generated illustration of a newly liberated Obelia medusa drifting in seawater",
    specimen: "Obelia sp. (young medusa)",
    specimenNote:
      "Same hydrozoan release pattern as T. dohrnii — a tiny, almost colourless saucer with sparse rim tentacles.",
  },
  mature: {
    label: "Mature medusa",
    caption: "Full grown, oral arms trail and sting to feed, tentacles reaching wide.",
    detail:
      "A mature T. dohrnii medusa reaches about 4.5 mm across, with up to roughly ninety fine tentacles and a " +
      "bright red stomach visible through a transparent bell — the field mark that lets divers and biologists " +
      "pick it out from lookalikes. This is the sexual stage: eggs and sperm are released into the water, " +
      "fertilisation produces a planula larva, and that larva settles to start a new polyp colony. It belongs " +
      "to the family Oceaniidae, small anthoathecate hydrozoans rather than the large scyphozoan “true jellies” " +
      "most people picture.",
    image: "./assets/stages/mature.png",
    imageAlt: "AI-generated illustration of a mature Oceania armata hydromedusa with a reddish stomach",
    specimen: "Oceania armata",
    specimenNote:
      "Same family as T. dohrnii (Oceaniidae). Shares the small transparent bell and coloured manubrium " +
      "that make mature lighthouse jellies recognisable.",
  },
  senescent: {
    label: "Senescent",
    caption: "Aging under stress — and for this species, the life cycle can still turn back.",
    detail:
      "Under starvation, injury, or old age, a T. dohrnii medusa begins to deteriorate: the bell shrinks and " +
      "loses symmetry, tentacles thin out, and the vivid red stomach dulls toward brown. In most jellyfish " +
      "species this is the end. Turritopsis can instead transform back into a polyp through reverse " +
      "development — cells changing role so the animal returns to an earlier body plan. Press Start over " +
      "to watch that return.",
    image: "./assets/stages/senescent.png",
    imageAlt: "AI-generated illustration of an aging, shrunken hydromedusa drifting in dim seawater",
    specimen: "Aging hydromedusa (Hydrozoa)",
    specimenNote:
      "Clear photos of T. dohrnii mid-decline are rare; this stand-in shows the shrunken bell and dulled " +
      "organs you would look for at this stage.",
  },
};
