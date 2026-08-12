# Process overview

## What I built

An interactive explainer of *Turritopsis dohrnii*'s biological immortality,
built around one mechanic: a "Let time pass" button that steps a hand-drawn
SVG jellyfish from polyp through young and mature medusa to senescence — and
then, on one more press, back to polyp. That wrap is never named in text;
it's discovered by pressing once past what looks like the end, signalled
only by an infinity-symbol ripple. Everything else — the ocean scene, the
per-stage dialogs, the rebirth explainer unlocked after the first loop —
sits around that one interaction without adding a second.

## The moments that mattered

**1. Scrubber to button-stepper.** The original design used a continuous
`<input type="range">`, dragged to blend between life-cycle keyframes; I
chose it for its native accessibility semantics. But dragging never produced
anything that read as an animated transition. The blend tracked the pointer
instantly, leaving no room for the crossfade flourish to land as a designed
event. So I replaced it with a "Let time pass" button that steps one stage
per press and plays the full animation each time. It is still a real
`<button>` with native keyboard and touch semantics, only discrete. I
checked it by watching each step play out at both marking viewports
(1920×1080 and 390×844): every press now lands as its own event, and that
gives the visitor a reason to keep pressing.
([`60ac751`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-cxin16215-netizen/commit/60ac751))

**2. The bottle stays a one-time thing.** After the loop reset landed, the
obvious next step was a fuller payoff: a proper journaling feature the
visitor could write to and revisit. I scoped it down instead. The dialog
opens once, holds a textarea and a "cast it away" button, stores nothing
anywhere, and the throwing animation is the whole point. I checked this
against the brief's own "one idea, one mechanic" constraint before writing
it. A second real feature would have diluted the mechanic the whole site is
built around.
([`cfdbc4b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-cxin16215-netizen/commit/cfdbc4b))

**3. An accessibility check that couldn't fail.** I wired axe-core over the
built page and every test passed first run. Instead of banking that, I tried
to make it fail. I couldn't: with the dialogs merely opened, stripping an
`<img alt>` and unnaming a close button both still reported zero violations.
JSDOM can't model a modal top layer, so axe was abandoning most of its rules
as "incomplete", which reports identically to passing. Hoisting the dialog
content out of its shell restored a real audit and caught both. I added a
permanent guard on how many rules actually get evaluated, so the suite goes
red if the audit ever silently stops.
([`048bf48`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-cxin16215-netizen/commit/048bf48))

**4. A wholesale rebuild of the presentation.** Four stages in, every check
passed and the piece still read as a small demo, nowhere near the
documentary register I wanted. I couldn't point at one defect, and asking for
targeted fixes would only have meant guessing at them, so I rebuilt the
presentation in a single pass: the framing line moved out of the page
flow into a splash that holds before fading, the animal grew to dominate the
frame, and a particle field gave it a habitat. The deliberate part was what
I left out. Captions say what a stage is and never what happens between
stages, so the loop stays something the visitor finds for themselves. This is an
explainer, and the atmosphere must stay behind the thing being explained:
every ambient layer is `aria-hidden` and non-interactive, and when two
easter eggs could fire together I decoupled them.
([`af511f1`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-cxin16215-netizen/commit/af511f1))
