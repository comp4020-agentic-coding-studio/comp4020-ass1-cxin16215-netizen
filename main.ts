import { STAGES, STAGE_INFO, KEYFRAME_PARAMS, ease, nextStage, isLoopTransition, blendParams, type Stage } from "./life-cycle";

const TRANSITION_MS = 900;
const PARTICLE_COUNT = 28;
const FLEX_DISPLACE_PULSE = 3;
const FLEX_SCALE_PULSE = 0.04;

const scene = document.querySelector<SVGSVGElement>("#jelly-scene");
const stageEls = new Map(
  STAGES.map((stage) => [stage, document.querySelector<SVGGElement>(`[data-stage="${stage}"]`)]),
);
const glowBlur = document.querySelector<SVGFEGaussianBlurElement>("#glowBlur");
const organicDisplace = document.querySelector<SVGFEDisplacementMapElement>("#organicDisplace");
const rippleAnim = document.querySelector<SVGAnimateElement>("#rippleAnim");
const currentLabelEl = document.querySelector<HTMLParagraphElement>("#current-stage-label");
const particlesContainer = document.querySelector<HTMLDivElement>(".particles");
const fishSchoolEls = Array.from(document.querySelectorAll<SVGSVGElement>(".fish-school"));
const sharkEl = document.querySelector<SVGSVGElement>(".shark");
const urchinEls = Array.from(document.querySelectorAll<SVGSVGElement>(".urchin"));
const dizzyFishEl = document.querySelector<SVGSVGElement>(".fish-school-3");
const nextButton = document.querySelector<HTMLButtonElement>("#next-stage");
const infoButton = document.querySelector<HTMLButtonElement>("#info-toggle");
const infoDialog = document.querySelector<HTMLDialogElement>("#stage-info");
const infoTitle = document.querySelector<HTMLHeadingElement>("#stage-info-title");
const infoDetail = document.querySelector<HTMLParagraphElement>("#stage-info-detail");
const infoClose = document.querySelector<HTMLButtonElement>("#stage-info-close");
const soundToggle = document.querySelector<HTMLButtonElement>("#sound-toggle");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let current: Stage = "polyp";
let animating = false;
let soundMuted = false;
let audioCtx: AudioContext | null = null;

function applyParams(stage: Stage): void {
  const p = KEYFRAME_PARAMS[stage];
  scene?.style.setProperty("--hue", `${p.hueDeg}deg`);
  scene?.style.setProperty("--sat", String(p.saturate));
  scene?.style.setProperty("--scale", String(p.scale));
  glowBlur?.setAttribute("stdDeviation", String(p.blurStd));
  organicDisplace?.setAttribute("scale", String(p.displaceScale));
}

// The button carries the "life force" cue for as long as the jellyfish is
// actually in the senescent stage, not just during the loop-reset transition
// -- so it's driven off the stage itself, wherever `current` gets set.
function applyButtonMood(stage: Stage): void {
  nextButton?.classList.toggle("is-senescent", stage === "senescent");
}

function showStage(stage: Stage): void {
  STAGES.forEach((s) => {
    const el = stageEls.get(s);
    if (el) el.style.opacity = s === stage ? "1" : "0";
  });
  applyParams(stage);
  applyButtonMood(stage);
  if (currentLabelEl) currentLabelEl.textContent = STAGE_INFO[stage].label;
}

// 2800ms matches the ouroboros-draw keyframes' duration (styles.css) -- the
// class must outlive the draw-in/pulse/return sequence or it gets cut short.
function flourishLoop(): void {
  scene?.classList.add("is-resetting");
  if (!prefersReducedMotion) rippleAnim?.beginElement();
  window.setTimeout(() => {
    scene?.classList.remove("is-resetting");
  }, 2800);
}

// Reaching senescence reliably fires the fish-school/shark chase easter egg
// -- restarting the CSS animation from scratch (remove, reflow, re-add) so it
// plays in full even if a rare ambient cycle had already left it mid-flight.
function triggerChase(): void {
  if (prefersReducedMotion) return;
  const els = [...fishSchoolEls, sharkEl];
  els.forEach((el) => el?.classList.remove("chase-active"));
  void document.body.offsetWidth;
  els.forEach((el) => el?.classList.add("chase-active"));
  if (Math.random() < 0.5) triggerUrchinRain();
}

// A second, rarer easter egg riding along with the chase: about half the
// time, a scatter of sea urchins also falls. There's no real collision --
// urchin-1's fall is just loosely timed to cross fish-school-3's height
// around when the chase carries it past, so the dizzy-stars payoff reads as
// a coincidental bonk rather than a scripted hit.
function triggerUrchinRain(): void {
  urchinEls.forEach((el) => el.classList.remove("urchin-active"));
  void document.body.offsetWidth;
  urchinEls.forEach((el) => el.classList.add("urchin-active"));
  window.setTimeout(() => dizzyFishEl?.classList.add("dizzy"), 1100);
  window.setTimeout(() => dizzyFishEl?.classList.remove("dizzy"), 2900);
}

// Procedural sound effects -- synthesised with the Web Audio API rather than
// shipped as audio files, in keeping with the rest of the page (every visual
// is hand-authored SVG/CSS, no external assets). Lazily created and resumed
// only from within a click handler, so it satisfies the browser's autoplay
// gesture requirement.
function ensureAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

// A short synthesised "blub": two slightly detuned sine tones, each gliding
// down in pitch with a fast exponential decay, for a rounder bubble timbre
// than a single pure tone.
function playBubble(baseFreq = 520): void {
  if (soundMuted) return;
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  [1, 1.5].forEach((detune, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq * detune, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * detune * 0.4, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.16 : 0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  });
}

// A richer swell of ascending bubbles for the loop-reset, under the
// ouroboros/senescent-glow flourish.
function playLoopSwell(): void {
  if (soundMuted) return;
  [420, 560, 700, 880].forEach((freq, i) => {
    window.setTimeout(() => playBubble(freq), i * 140);
  });
}

function animateTransition(from: Stage, to: Stage): void {
  animating = true;
  nextButton?.setAttribute("disabled", "true");
  const looping = isLoopTransition(from, to);
  if (looping) playLoopSwell();
  else playBubble();
  if (to === "senescent") triggerChase();

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
    // A bell-curve "flex" peaking mid-transition, on top of the linear blend
    // -- the tentacles wobble a touch wider and the whole body overshoots its
    // target size by a hair before settling, so every stage change reads as
    // a living flex rather than a flat crossfade.
    const flex = Math.sin(raw * Math.PI);
    if (fromEl) fromEl.style.opacity = String(1 - eased);
    if (toEl) toEl.style.opacity = String(eased);
    scene?.style.setProperty("--hue", `${blendParams(from, to, raw, "hueDeg")}deg`);
    scene?.style.setProperty("--sat", String(blendParams(from, to, raw, "saturate")));
    scene?.style.setProperty("--scale", String(blendParams(from, to, raw, "scale") + flex * FLEX_SCALE_PULSE));
    glowBlur?.setAttribute("stdDeviation", String(blendParams(from, to, raw, "blurStd")));
    organicDisplace?.setAttribute(
      "scale",
      String(blendParams(from, to, raw, "displaceScale") + flex * FLEX_DISPLACE_PULSE),
    );

    if (raw < 1) {
      requestAnimationFrame(frame);
      return;
    }
    current = to;
    applyButtonMood(to);
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

soundToggle?.addEventListener("click", () => {
  soundMuted = !soundMuted;
  soundToggle.setAttribute("aria-pressed", String(soundMuted));
  soundToggle.setAttribute("aria-label", soundMuted ? "Unmute sound effects" : "Mute sound effects");
  if (!soundMuted) playBubble();
});

spawnParticles();
showStage(current);
