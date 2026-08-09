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
`<input type="range">`, dragged to blend between life-cycle keyframes —
chosen for its native accessibility semantics. But dragging never produced
anything that read as an animated transition: the blend tracked the pointer
instantly, leaving no room for the crossfade flourish to land as a designed
event. So I replaced it with a "Let time pass" button that steps one stage
per press and plays the full animation each time — still a real `<button>`
with native keyboard and touch semantics, just discrete instead of
continuous. I checked it by watching each step play out at both marking
viewports (1920×1080 and 390×844): a press now reads as an event rather than
a live-tracked drag, and it gives the visitor a reason to keep pressing.
([`60ac751`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-cxin16215-netizen/commit/60ac751))

**2. Keeping the bottle a ritual, not a second mechanic.** After the loop
reset landed, the obvious next step was a fuller payoff — a proper journaling
feature the visitor could write to and revisit. I scoped it down instead: a
one-time dialog with a textarea and a "cast it away" button, nothing typed is
stored or sent anywhere, and the throwing animation is the whole point. I
checked this against the brief's own "one idea, one mechanic" constraint
before writing it — a second real feature would have diluted the mechanic
the whole site is built around, not supported it.
([`cfdbc4b`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-cxin16215-netizen/commit/cfdbc4b))

**3. An accessibility check that couldn't fail.** I wired axe-core over the
built page and every test passed first run. Instead of banking that, I tried
to make it fail — and couldn't: with the dialogs merely opened, stripping an
`<img alt>` and unnaming a close button both still reported zero violations.
JSDOM can't model a modal top layer, so axe was abandoning ~30 rules as
"incomplete", which reports identically to passing. Hoisting the dialog
content out of its shell restored a real audit and caught both. I added a
permanent guard on how many rules actually get evaluated, so the suite goes
red if the audit ever silently stops.
([`048bf48`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-cxin16215-netizen/commit/048bf48))

**4. Rebuilding the presentation instead of patching it.** Four stages in,
every check passed and the piece still read as a small demo rather than the
documentary register I was aiming for. I couldn't point at one defect, so
rather than ask for targeted fixes I rebuilt the presentation in a single
pass: the framing line moved out of the page flow into a splash that holds
before fading, the animal grew to dominate the frame, and a particle field
gave it a habitat. The deliberate part was what I did *not* add — captions
say what a stage is and never what happens between stages, so the loop stays
something you discover rather than read. This is an explainer, and the
atmosphere is not allowed to compete with the thing being explained: every
ambient layer is `aria-hidden` and non-interactive, and when two easter eggs
could fire together I decoupled them rather than let the page get crowded.
([`af511f1`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-cxin16215-netizen/commit/af511f1))
