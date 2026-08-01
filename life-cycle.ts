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

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
}

export interface Blend {
  from: number;
  to: number;
  localT: number;
}

// t in [0,1). Four stages make three segments; the reset (t wrapping back
// to 0) is handled by the caller via shouldReset, not in here.
export function stageBlend(t: number): Blend {
  const segments = STAGES.length - 1;
  const clamped = Math.min(Math.max(t, 0), 1 - Number.EPSILON);
  const raw = clamped * segments;
  const from = Math.min(Math.floor(raw), segments - 1);
  return { from, to: from + 1, localT: easeInOutCubic(raw - from) };
}

export function lerpParam(param: keyof StageParams, t: number): number {
  const { from, to, localT } = stageBlend(t);
  const a = KEYFRAME_PARAMS[STAGES[from]][param];
  const b = KEYFRAME_PARAMS[STAGES[to]][param];
  return a + (b - a) * localT;
}

export function shouldReset(raw: number, max: number): boolean {
  return raw >= max;
}
