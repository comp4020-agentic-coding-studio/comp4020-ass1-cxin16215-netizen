import { STAGES, STAGE_INFO, stageBlend, lerpParam, shouldReset, activeStageLabel, type Stage } from "./life-cycle";

const MAX = 10_000;
const PARTICLE_COUNT = 28;

const input = document.querySelector<HTMLInputElement>("#scrubber");
const scene = document.querySelector<SVGSVGElement>("#jelly-scene");
const stageEls = new Map(
  STAGES.map((stage) => [stage, document.querySelector<SVGGElement>(`[data-stage="${stage}"]`)]),
);
const glowBlur = document.querySelector<SVGFEGaussianBlurElement>("#glowBlur");
const organicDisplace = document.querySelector<SVGFEDisplacementMapElement>("#organicDisplace");
const rippleAnim = document.querySelector<SVGAnimateElement>("#rippleAnim");
const captionEl = document.querySelector<HTMLParagraphElement>("#stage-caption");
const particlesContainer = document.querySelector<HTMLDivElement>(".particles");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let resetting = false;
let queued = false;
let lastCaptionStage: Stage | null = null;
let captionSwapTimer: number | undefined;

function updateCaption(t: number): void {
  const stage = activeStageLabel(t);
  if (stage === lastCaptionStage || !captionEl) return;
  lastCaptionStage = stage;
  captionEl.style.opacity = "0";
  window.clearTimeout(captionSwapTimer);
  captionSwapTimer = window.setTimeout(() => {
    captionEl.textContent = STAGE_INFO[stage].caption;
    captionEl.style.opacity = "1";
  }, 150);
}

function render(t: number): void {
  const { from, to, localT } = stageBlend(t);
  STAGES.forEach((stage, i) => {
    const el = stageEls.get(stage);
    if (!el) return;
    el.style.opacity = i === from ? String(1 - localT) : i === to ? String(localT) : "0";
  });

  scene?.style.setProperty("--hue", `${lerpParam("hueDeg", t)}deg`);
  scene?.style.setProperty("--sat", String(lerpParam("saturate", t)));
  scene?.style.setProperty("--scale", String(lerpParam("scale", t)));
  glowBlur?.setAttribute("stdDeviation", String(lerpParam("blurStd", t)));
  organicDisplace?.setAttribute("scale", String(lerpParam("displaceScale", t)));
  updateCaption(t);
}

function scheduleRender(t: number): void {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    render(t);
  });
}

function spawnParticles(): void {
  if (!particlesContainer || prefersReducedMotion) return;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.setProperty("--x", `${Math.random() * 100}%`);
    particle.style.setProperty("--size", `${1 + Math.random() * 2.5}px`);
    particle.style.setProperty("--duration", `${14 + Math.random() * 18}s`);
    particle.style.setProperty("--delay", `${Math.random() * -30}s`);
    particle.style.setProperty("--drift", `${(Math.random() - 0.5) * 40}px`);
    particlesContainer.appendChild(particle);
  }
}

input?.addEventListener("input", () => {
  const raw = Number(input.value);
  scheduleRender(raw / MAX);

  if (shouldReset(raw, MAX) && !resetting) {
    resetting = true;
    scene?.classList.add("is-resetting");
    if (!prefersReducedMotion) rippleAnim?.beginElement();
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

spawnParticles();
render(0);
