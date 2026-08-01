import { STAGES, stageBlend, lerpParam, shouldReset } from "./life-cycle";

const MAX = 10_000;

const input = document.querySelector<HTMLInputElement>("#scrubber");
const scene = document.querySelector<SVGSVGElement>("#jelly-scene");
const stageEls = new Map(
  STAGES.map((stage) => [stage, document.querySelector<SVGGElement>(`[data-stage="${stage}"]`)]),
);
const glowBlur = document.querySelector<SVGFEGaussianBlurElement>("#glowBlur");

let resetting = false;
let queued = false;

function render(t: number): void {
  const { from, to, localT } = stageBlend(t);
  STAGES.forEach((stage, i) => {
    const el = stageEls.get(stage);
    if (!el) return;
    el.style.opacity = i === from ? String(1 - localT) : i === to ? String(localT) : "0";
  });

  scene?.style.setProperty("--hue", `${lerpParam("hueDeg", t)}deg`);
  scene?.style.setProperty("--sat", String(lerpParam("saturate", t)));
  glowBlur?.setAttribute("stdDeviation", String(lerpParam("blurStd", t)));
}

function scheduleRender(t: number): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    render(t);
  });
}

input?.addEventListener("input", () => {
  const raw = Number(input.value);
  scheduleRender(raw / MAX);

  if (shouldReset(raw, MAX) && !resetting) {
    resetting = true;
    scene?.classList.add("is-resetting");
    window.setTimeout(() => {
      input.value = "0";
      render(0);
    }, 160);
    window.setTimeout(() => {
      scene?.classList.remove("is-resetting");
      resetting = false;
    }, 420);
  }
});

render(0);
