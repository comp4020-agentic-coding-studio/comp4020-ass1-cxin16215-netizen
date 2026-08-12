import { STAGES, STAGE_INFO, KEYFRAME_PARAMS, ease, nextStage, isLoopTransition, blendParams, type Stage } from "./life-cycle";

const TRANSITION_MS = 1100;
const PARTICLE_COUNT = 28;
const MORPH_DISPLACE = 14;
const MORPH_BLUR_EXTRA = 5;

const scene = document.querySelector<SVGSVGElement>("#jelly-scene");
const stageEls = new Map(
  STAGES.map((stage) => [stage, document.querySelector<SVGGElement>(`[data-stage="${stage}"]`)]),
);
const glowBlur = document.querySelector<SVGFEGaussianBlurElement>("#glowBlur");
const organicDisplace = document.querySelector<SVGFEDisplacementMapElement>("#organicDisplace");
const rippleAnim = document.querySelector<SVGAnimateElement>("#rippleAnim");
const currentLabelEl = document.querySelector<HTMLParagraphElement>("#current-stage-label");
const stageCaptionEl = document.querySelector<HTMLParagraphElement>("#stage-caption");
const nextStageLabel = document.querySelector<HTMLSpanElement>("#next-stage-label");
const particlesContainer = document.querySelector<HTMLDivElement>(".particles");
const fishSchoolEls = Array.from(document.querySelectorAll<SVGSVGElement>(".fish-school"));
const sharkEl = document.querySelector<SVGSVGElement>(".shark");
const urchinEls = Array.from(document.querySelectorAll<SVGSVGElement>(".urchin"));
const dizzyFishEl = document.querySelector<SVGSVGElement>(".fish-school-3");
const nextButton = document.querySelector<HTMLButtonElement>("#next-stage");
const infoButton = document.querySelector<HTMLButtonElement>("#info-toggle");
const infoDialog = document.querySelector<HTMLDialogElement>("#stage-info");
const infoTitle = document.querySelector<HTMLHeadingElement>("#stage-info-title");
const infoCaption = document.querySelector<HTMLParagraphElement>("#stage-info-caption");
const infoDetail = document.querySelector<HTMLParagraphElement>("#stage-info-detail");
const infoPhoto = document.querySelector<HTMLImageElement>("#stage-info-photo");
const infoFigure = document.querySelector<HTMLElement>(".reference-photo");
const infoSpecimen = document.querySelector<HTMLElement>("#stage-info-specimen");
const infoSpecimenNote = document.querySelector<HTMLElement>("#stage-info-specimen-note");
const infoClose = document.querySelector<HTMLButtonElement>("#stage-info-close");
const soundToggle = document.querySelector<HTMLButtonElement>("#sound-toggle");
const bottleDialog = document.querySelector<HTMLDialogElement>("#bottle-dialog");
const bottleDialogClose = document.querySelector<HTMLButtonElement>("#bottle-dialog-close");
const bottleMessage = document.querySelector<HTMLTextAreaElement>("#bottle-message");
const bottleThrow = document.querySelector<HTMLButtonElement>("#bottle-throw");
const rebirthToggle = document.querySelector<HTMLButtonElement>("#rebirth-toggle");
const rebirthDialog = document.querySelector<HTMLDialogElement>("#rebirth-info");
const rebirthClose = document.querySelector<HTMLButtonElement>("#rebirth-info-close");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let current: Stage = "polyp";
let animating = false;
let soundMuted = true;
const AMBIENT_GAIN = 0.055;
let ambient: {
  source: AudioBufferSourceNode;
  gain: GainNode;
  lfo: OscillatorNode;
  bubbles: number;
} | null = null;
let audioCtx: AudioContext | null = null;
let hasShownBottleDialog = false;
let hasUnlockedRebirth = false;

function buttonLabelFor(stage: Stage): string {
  return stage === "senescent" ? "Start over" : "Let time pass";
}

function applyParams(stage: Stage): void {
  const p = KEYFRAME_PARAMS[stage];
  scene?.style.setProperty("--hue", `${p.hueDeg}deg`);
  scene?.style.setProperty("--sat", String(p.saturate));
  scene?.style.setProperty("--scale", String(p.scale));
  glowBlur?.setAttribute("stdDeviation", String(p.blurStd));
  organicDisplace?.setAttribute("scale", String(p.displaceScale));
}

function applyButtonMood(stage: Stage): void {
  nextButton?.classList.toggle("is-senescent", stage === "senescent");
  if (nextStageLabel) nextStageLabel.textContent = buttonLabelFor(stage);
}

function applyStageCopy(stage: Stage): void {
  if (currentLabelEl) currentLabelEl.textContent = STAGE_INFO[stage].label;
  if (stageCaptionEl) stageCaptionEl.textContent = STAGE_INFO[stage].caption;
}

function clearStageMotion(el: SVGGElement | null | undefined): void {
  if (!el) return;
  el.style.opacity = "";
  el.style.transform = "";
  el.style.filter = "";
}

function showStage(stage: Stage): void {
  STAGES.forEach((s) => {
    const el = stageEls.get(s);
    if (!el) return;
    clearStageMotion(el);
    el.style.opacity = s === stage ? "1" : "0";
  });
  applyParams(stage);
  applyButtonMood(stage);
  applyStageCopy(stage);
}

function flourishLoop(): void {
  scene?.classList.add("is-resetting");
  if (!prefersReducedMotion) rippleAnim?.beginElement();
  window.setTimeout(() => {
    scene?.classList.remove("is-resetting");
    unlockRebirthExplainer();
    maybeShowBottleDialog();
  }, 2800);
}

function unlockRebirthExplainer(): void {
  if (hasUnlockedRebirth || !rebirthToggle) return;
  hasUnlockedRebirth = true;
  rebirthToggle.hidden = false;
  if (!prefersReducedMotion) rebirthToggle.classList.add("is-visible");
}

function maybeShowBottleDialog(): void {
  if (hasShownBottleDialog) return;
  hasShownBottleDialog = true;
  if (bottleMessage) bottleMessage.value = "";
  bottleDialog?.classList.remove("is-throwing");
  bottleDialog?.showModal();
}

function triggerChase(): void {
  if (prefersReducedMotion) return;
  const els = [...fishSchoolEls, sharkEl];
  els.forEach((el) => el?.classList.remove("chase-active"));
  void document.body.offsetWidth;
  els.forEach((el) => el?.classList.add("chase-active"));
}

function triggerUrchinRain(): void {
  if (prefersReducedMotion) return;
  urchinEls.forEach((el) => el.classList.remove("urchin-active"));
  void document.body.offsetWidth;
  urchinEls.forEach((el) => el.classList.add("urchin-active"));
  window.setTimeout(() => dizzyFishEl?.classList.add("dizzy"), 1100);
  window.setTimeout(() => dizzyFishEl?.classList.remove("dizzy"), 2900);
}

function ensureAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// Underwater bubble: a muffled rising tone (growing/escaping pocket of air)
// plus a tiny bandpassed noise shell so it reads as water, not a synth beep.
function playBubble(size = 1): void {
  if (soundMuted) return;
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const scale = Math.min(Math.max(size, 0.55), 1.7);
  const startFreq = (140 + Math.random() * 40) / scale;
  const peakFreq = (420 + Math.random() * 160) * Math.sqrt(scale);
  const dur = 0.12 + scale * 0.1;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.2 / scale, now + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  master.connect(ctx.destination);

  const osc = ctx.createOscillator();
  const toneFilter = ctx.createBiquadFilter();
  osc.type = "sine";
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(peakFreq, startFreq + 1), now + dur * 0.55);
  osc.frequency.exponentialRampToValueAtTime(peakFreq * 0.85, now + dur);
  toneFilter.type = "bandpass";
  toneFilter.frequency.setValueAtTime(peakFreq * 0.9, now);
  toneFilter.Q.setValueAtTime(4.5, now);
  const toneGain = ctx.createGain();
  toneGain.gain.value = 0.85;
  osc.connect(toneFilter).connect(toneGain).connect(master);
  osc.start(now);
  osc.stop(now + dur + 0.02);

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, dur + 0.05);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(700 + Math.random() * 500, now);
  noiseFilter.Q.setValueAtTime(1.2, now);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.07, now + 0.008);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.7);
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start(now);
  noise.stop(now + dur + 0.02);
}

// Deep-sea room tone. A long noise loop pushed through a low lowpass so only
// the swell survives, with a very slow LFO opening and closing the filter so
// it breathes rather than hisses, plus sparse distant bubbles so the ambience
// has events and not just texture. Synthesised, not a file: the site ships no
// audio assets at all, so this costs nothing on the wire.
function startAmbient(): void {
  if (ambient) return;
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;

  const source = ctx.createBufferSource();
  source.buffer = makeNoiseBuffer(ctx, 4);
  source.loop = true;

  const rumbleCut = ctx.createBiquadFilter();
  rumbleCut.type = "highpass";
  rumbleCut.frequency.setValueAtTime(45, now);

  const swell = ctx.createBiquadFilter();
  swell.type = "lowpass";
  swell.frequency.setValueAtTime(255, now);
  swell.Q.setValueAtTime(0.7, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(AMBIENT_GAIN, now + 2.5);

  // ~17s period: slow enough to feel like water moving, not tremolo.
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.setValueAtTime(0.06, now);
  lfoDepth.gain.setValueAtTime(90, now);
  lfo.connect(lfoDepth).connect(swell.frequency);
  lfo.start(now);

  source.connect(rumbleCut).connect(swell).connect(gain).connect(ctx.destination);
  source.start(now);

  const bubbles = window.setInterval(() => {
    if (Math.random() < 0.5) playBubble(0.6);
  }, 5200);

  ambient = { source, gain, lfo, bubbles };
}

function stopAmbient(): void {
  if (!ambient) return;
  const { source, gain, lfo, bubbles } = ambient;
  ambient = null;
  window.clearInterval(bubbles);
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  source.stop(now + 0.9);
  lfo.stop(now + 0.9);
}

// A soft trail of uneven bubbles for the loop-reset — like air escaping upward.
function playLoopSwell(): void {
  if (soundMuted) return;
  const sizes = [1.35, 1.05, 0.85, 0.7, 0.95, 0.6];
  sizes.forEach((size, i) => {
    window.setTimeout(() => playBubble(size), i * 110 + Math.random() * 40);
  });
}

// Bottle hitting water: a denser gurgle of overlapping bubbles, not a bright splash.
function playSplash(): void {
  if (soundMuted) return;
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, 0.45);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(900, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(220, now + 0.4);
  noiseFilter.Q.setValueAtTime(0.6, now);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.45);

  [1.4, 1.1, 0.85, 0.7, 0.95].forEach((size, i) => {
    window.setTimeout(() => playBubble(size), 20 + i * 55);
  });
}

// Metamorphosis-style transition: the outgoing form collapses and dissolves,
// then the incoming form unfolds from a tighter, blurrier state — closer to
// tissue reorganisation than a flat crossfade of two stills.
function animateTransition(from: Stage, to: Stage): void {
  animating = true;
  nextButton?.setAttribute("disabled", "true");
  const looping = isLoopTransition(from, to);
  if (looping) playLoopSwell();
  else playBubble();
  if (to === "senescent") triggerChase();
  else if (!looping && Math.random() < 0.35) triggerUrchinRain();

  if (prefersReducedMotion) {
    current = to;
    showStage(to);
    if (looping) {
      unlockRebirthExplainer();
      flourishLoop();
    }
    animating = false;
    nextButton?.removeAttribute("disabled");
    return;
  }

  const fromEl = stageEls.get(from);
  const toEl = stageEls.get(to);
  const start = performance.now();
  const fromParams = KEYFRAME_PARAMS[from];
  const toParams = KEYFRAME_PARAMS[to];

  if (fromEl) {
    fromEl.style.opacity = "1";
    fromEl.style.transform = "scale(1)";
  }
  if (toEl) {
    toEl.style.opacity = "0";
    toEl.style.transform = "scale(0.72)";
  }

  if (looping) flourishLoop();

  function frame(now: number): void {
    const raw = Math.min((now - start) / TRANSITION_MS, 1);
    const collapse = ease(Math.min(raw / 0.48, 1));
    const emerge = ease(Math.max((raw - 0.38) / 0.62, 0));
    const morph = Math.sin(Math.min(raw, 1) * Math.PI);

    if (fromEl) {
      fromEl.style.opacity = String(1 - collapse);
      fromEl.style.transform = `scale(${1 - collapse * 0.38})`;
      fromEl.style.filter = `url("#glow") blur(${collapse * 2.4}px)`;
    }
    if (toEl) {
      toEl.style.opacity = String(emerge);
      toEl.style.transform = `scale(${0.72 + emerge * 0.28})`;
      toEl.style.filter = `url("#glow") blur(${(1 - emerge) * 2.8}px)`;
    }

    scene?.style.setProperty("--hue", `${blendParams(from, to, raw, "hueDeg")}deg`);
    scene?.style.setProperty("--sat", String(blendParams(from, to, raw, "saturate")));
    scene?.style.setProperty(
      "--scale",
      String(fromParams.scale + (toParams.scale - fromParams.scale) * emerge - morph * 0.06),
    );
    glowBlur?.setAttribute(
      "stdDeviation",
      String(blendParams(from, to, raw, "blurStd") + morph * MORPH_BLUR_EXTRA),
    );
    organicDisplace?.setAttribute(
      "scale",
      String(blendParams(from, to, raw, "displaceScale") + morph * MORPH_DISPLACE),
    );

    if (raw < 1) {
      requestAnimationFrame(frame);
      return;
    }

    current = to;
    showStage(to);
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

// A browser keeps showing the old image until the new one has decoded, which
// here means the previous stage's animal sitting under this stage's caption,
// species name and alt text. Hide it and show the placeholder instead until
// the right photo is actually ready.
function swapStagePhoto(image: string, imageAlt: string): void {
  if (!infoPhoto) return;
  infoPhoto.alt = imageAlt;
  const current = infoPhoto.getAttribute("src");
  if (current === image && infoPhoto.complete) return;
  infoFigure?.classList.add("is-loading");
  infoPhoto.src = image;
  // Already in cache: clear the placeholder in the same frame so repeat
  // opens don't flash an empty panel.
  if (infoPhoto.complete) infoFigure?.classList.remove("is-loading");
}

// Both events, so a photo that 404s clears the placeholder too rather than
// leaving the panel shimmering forever.
infoPhoto?.addEventListener("load", () => infoFigure?.classList.remove("is-loading"));
infoPhoto?.addEventListener("error", () => infoFigure?.classList.remove("is-loading"));

function fillStageInfo(stage: Stage): void {
  const info = STAGE_INFO[stage];
  if (infoTitle) infoTitle.textContent = info.label;
  if (infoCaption) infoCaption.textContent = info.caption;
  if (infoDetail) infoDetail.textContent = info.detail;
  swapStagePhoto(info.image, info.imageAlt);
  if (infoSpecimen) infoSpecimen.textContent = info.specimen;
  if (infoSpecimenNote) infoSpecimenNote.textContent = info.specimenNote;
}

infoButton?.addEventListener("click", () => {
  fillStageInfo(current);
  infoDialog?.showModal();
});

infoClose?.addEventListener("click", () => infoDialog?.close());

function closeOnBackdropClick(dialog: HTMLDialogElement): void {
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outside) dialog.close();
  });
}

if (infoDialog) closeOnBackdropClick(infoDialog);
if (bottleDialog) closeOnBackdropClick(bottleDialog);
if (rebirthDialog) closeOnBackdropClick(rebirthDialog);

rebirthToggle?.addEventListener("click", () => rebirthDialog?.showModal());
rebirthClose?.addEventListener("click", () => rebirthDialog?.close());

bottleDialogClose?.addEventListener("click", () => bottleDialog?.close());

bottleThrow?.addEventListener("click", () => {
  playSplash();
  if (prefersReducedMotion) {
    bottleDialog?.close();
    return;
  }
  bottleDialog?.classList.add("is-throwing");
  window.setTimeout(() => {
    bottleDialog?.close();
    bottleDialog?.classList.remove("is-throwing");
  }, 1400);
});

soundToggle?.addEventListener("click", () => {
  soundMuted = !soundMuted;
  soundToggle.setAttribute("aria-pressed", String(soundMuted));
  soundToggle.setAttribute("aria-label", soundMuted ? "Unmute sound" : "Mute sound");
  if (soundMuted) {
    stopAmbient();
    return;
  }
  startAmbient();
  playBubble();
});

// Don't keep a drone running in a tab nobody is looking at. Suspending the
// whole context also parks the ambience cheaply, and it comes back on return
// unless the visitor muted in the meantime.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (audioCtx?.state === "running") void audioCtx.suspend();
  } else if (!soundMuted && audioCtx?.state === "suspended") {
    void audioCtx.resume();
  }
});

spawnParticles();
showStage(current);
fillStageInfo(current);
