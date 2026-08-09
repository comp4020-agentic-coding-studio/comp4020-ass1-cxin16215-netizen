import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Accessibility sensor: runs axe-core over the BUILT page, like the other spec
// tests, so it checks what actually ships.
//
// WHAT THIS CANNOT SEE. JSDOM has no layout or paint engine, so rules needing
// computed geometry or rendered colour can't run here:
//   - colour contrast (disabled below — without pixels axe can only guess, and
//     a permanently-"incomplete" rule reads as passing when it isn't)
//   - target size, overlap, anything reachable only by real focus or pointer
// Those still need a human at the two marking viewports. Green here means "no
// structural or semantic violations", NOT "the page is accessible".
//
// The page's own script never runs (JSDOM doesn't fetch external resources),
// so this asserts the served state, with script-driven states staged by hand.

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const html = readFileSync(resolve("dist/index.html"), "utf8");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// Below this, axe has stopped meaningfully auditing and the suite would go
// vacuously green. Loose enough to survive an axe rule-set bump (a clean run
// evaluates ~21), tight enough to catch the sensor dying. See the
// "still has its eyes open" test.
const MIN_RULES_EVALUATED = 15;

interface AxeNode {
  html: string;
  failureSummary?: string;
}

interface AxeViolation {
  id: string;
  impact: string;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
}

interface AxeResults {
  violations: AxeViolation[];
  passes: { id: string }[];
  incomplete: { id: string }[];
}

// axe's result object is far richer than a failure message needs; collapse it
// to the rule, the element and the fix, so a red test says what to change
// without opening a browser.
function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `      ${node.html.slice(0, 160)}\n      → ${node.failureSummary?.replace(/\n/g, " ")}`)
        .join("\n");
      return `  [${violation.impact}] ${violation.id}: ${violation.help}\n${nodes}\n      ${violation.helpUrl}`;
    })
    .join("\n\n");
}

async function audit(prepare?: (doc: Document) => void): Promise<AxeResults> {
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
  prepare?.(dom.window.document as unknown as Document);
  dom.window.eval(axeSource);
  const results = await (
    dom.window as unknown as {
      axe: { run: (ctx: unknown, opts: unknown) => Promise<AxeResults> };
    }
  ).axe.run(dom.window.document, {
    runOnly: { type: "tag", values: WCAG_TAGS },
    rules: { "color-contrast": { enabled: false } },
  });
  dom.window.close();
  return results;
}

// Lifts a dialog's CONTENT into the page as an ordinary region and drops the
// dialog shells.
//
// Why this is necessary, since it looks like cheating: a modal <dialog open>
// puts its content in the browser's top layer and makes the rest of the page
// inert. JSDOM can't model that without layout, so axe gives up and marks
// ~30 rules "incomplete" — which surfaces as zero violations. Verified: with
// the dialogs merely opened, deliberately stripping an <img alt> and
// deliberately unnaming a close button BOTH still reported zero violations.
// Hoisting the content restores a real audit (21 rules evaluated) and both of
// those sabotages are caught.
//
// The trade: this checks the dialogs' semantics (names, alt text, ARIA,
// heading structure) but not native modal behaviour — focus trapping, Esc,
// focus restore. Those come from using a real <dialog> and are the browser's
// to honour; they need a human or a real browser to verify.
function hoistDialogContent(selector: string): (doc: Document) => void {
  return (doc) => {
    const dialog = doc.querySelector(selector);
    if (!dialog) throw new Error(`no dialog matched ${selector}`);
    const section = doc.createElement("section");
    section.setAttribute("aria-label", `dialog content under audit: ${selector}`);
    while (dialog.firstChild) section.appendChild(dialog.firstChild);
    for (const shell of doc.querySelectorAll("dialog")) shell.remove();
    doc.body.appendChild(section);
  };
}

function expectClean(results: AxeResults): void {
  expect(results.violations.length, `\n${formatViolations(results.violations)}\n`).toBe(0);
  expect(
    results.passes.length,
    `axe only evaluated ${results.passes.length} rules (${results.incomplete.length} incomplete) — ` +
      `the audit is no longer running properly, so a green result here means nothing`,
  ).toBeGreaterThanOrEqual(MIN_RULES_EVALUATED);
}

describe("accessibility: axe-core over the built page", () => {
  it("the page as a visitor first sees it has no WCAG A/AA violations", async () => {
    expectClean(await audit());
  });

  it("the stage detail dialog's content is clean", async () => {
    expectClean(await audit(hoistDialogContent("#stage-info")));
  });

  it("the rebirth explainer's content is clean once unlocked", async () => {
    expectClean(
      await audit((doc) => {
        // The toggle ships hidden and is revealed by script after the first
        // loop; stage the unlocked state so it gets audited too.
        doc.querySelector("#rebirth-toggle")?.removeAttribute("hidden");
        hoistDialogContent("#rebirth-info")(doc);
      }),
    );
  });

  it("the message-in-a-bottle dialog's content is clean", async () => {
    expectClean(await audit(hoistDialogContent("#bottle-dialog")));
  });

  // Guards the sensor itself. Every test above can only fail if axe is
  // actually evaluating rules; this one fails loudly if it silently stops.
  it("still has its eyes open (the audit really runs)", async () => {
    const { passes, incomplete } = await audit();
    expect(passes.length).toBeGreaterThanOrEqual(MIN_RULES_EVALUATED);
    expect(passes.map((rule) => rule.id)).toContain("button-name");
    expect(passes.map((rule) => rule.id)).toContain("svg-img-alt");
    expect(incomplete.length).toBeLessThan(passes.length);
  });
});
