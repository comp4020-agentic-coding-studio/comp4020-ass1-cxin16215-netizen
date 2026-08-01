import { STAGES, STAGE_INFO, KEYFRAME_PARAMS, ease, nextStage, isLoopTransition, blendParams, type Stage } from "./life-cycle";

const TRANSITION_MS = 900;
const PARTICLE_COUNT = 28;

const scene = document.querySelector<SVGSVGElement>("#jelly-scene");
const stageEls = new Map(
  STAGES.map((stage) => [stage, document.querySelector<SVGGElement>(`[data-stage="${stage}"]`)]),
);
const glowBlur = document.querySelector<SVGFEGaussianBlurElement>("#glowBlur");
const organicDisplace = document.querySelector<SVGFEDisplacementMapElement>("#organicDisplace");
const rippleAnim = document.querySelector<SVGAnimateElement>("#rippleAnim");
const currentLabelEl = document.querySelector<HTMLParagraphElement>("#current-stage-label");
const particlesContainer = document.querySelector<HTMLDivElement>(".particles");
const nextButton = document.querySelector<HTMLButtonElement>("#next-stage");
const infoButton = document.querySelector<HTMLButtonElement>("#info-toggle");
const infoDialog = document.querySelector<HTMLDialogElement>("#stage-info");
const infoTitle = document.querySelector<HTMLHeadingElement>("#stage-info-title");
const infoDetail = document.querySelector<HTMLParagraphElement>("#stage-info-detail");
const infoClose = document.querySelector<HTMLButtonElement>("#stage-info-close");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let current: Stage = "polyp";
let animating = false;

function applyParams(stage: Stage): void {
  const p = KEYFRAME_PARAMS[stage];
  scene?.style.setProperty("--hue", `${p.hueDeg}deg`);
  scene?.style.setProperty("--sat", String(p.saturate));
  scene?.style.setProperty("--scale", String(p.scale));
  glowBlur?.setAttribute("stdDeviation", String(p.blurStd));
  organicDisplace?.setAttribute("scale", String(p.displaceScale));
}

function showStage(stage: Stage): void {
  STAGES.forEach((s) => {
    const el = stageEls.get(s);
    if (el) el.style.opacity = s === stage ? "1" : "0";
  });
  applyParams(stage);
  if (currentLabelEl) currentLabelEl.textContent = STAGE_INFO[stage].label;
}

function flourishLoop(): void {
  scene?.classList.add("is-resetting");
  if (!prefersReducedMotion) rippleAnim?.beginElement();
  window.setTimeout(() => scene?.classList.remove("is-resetting"), 420);
}

function animateTransition(from: Stage, to: Stage): void {
  animating = true;
  nextButton?.setAttribute("disabled", "true");
  const looping = isLoopTransition(from, to);

  if (prefersReducedMotion) {
    current = to;
    showStage(to);
    if (looping) flourishLoop();
    animating = false;
    nextButton?.removeAttribute("disabled");
    return;
  }

  const fromEl = stageEls.get(from);
  const toEl = stageEls.get(to);
  const start = performance.now();

  if (looping) flourishLoop();

  function frame(now: number): void {
    const raw = Math.min((now - start) / TRANSITION_MS, 1);
    const eased = ease(raw);
    if (fromEl) fromEl.style.opacity = String(1 - eased);
    if (toEl) toEl.style.opacity = String(eased);
    scene?.style.setProperty("--hue", `${blendParams(from, to, raw, "hueDeg")}deg`);
    scene?.style.setProperty("--sat", String(blendParams(from, to, raw, "saturate")));
    scene?.style.setProperty("--scale", String(blendParams(from, to, raw, "scale")));
    glowBlur?.setAttribute("stdDeviation", String(blendParams(from, to, raw, "blurStd")));
    organicDisplace?.setAttribute("scale", String(blendParams(from, to, raw, "displaceScale")));

    if (raw < 1) {
      requestAnimationFrame(frame);
      return;
    }
    current = to;
    if (currentLabelEl) currentLabelEl.textContent = STAGE_INFO[to].label;
    animating = false;
    nextButton?.removeAttribute("disabled");
  }

  requestAnimationFrame(frame);
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

nextButton?.addEventListener("click", () => {
  if (animating) return;
  animateTransition(current, nextStage(current));
});

infoButton?.addEventListener("click", () => {
  if (infoTitle) infoTitle.textContent = STAGE_INFO[current].label;
  if (infoDetail) infoDetail.textContent = STAGE_INFO[current].detail;
  infoDialog?.showModal();
});

infoClose?.addEventListener("click", () => infoDialog?.close());

spawnParticles();
showStage(current);
