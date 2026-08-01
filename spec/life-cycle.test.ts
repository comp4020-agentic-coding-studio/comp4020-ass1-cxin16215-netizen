import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { STAGES, STAGE_INFO, stageBlend, lerpParam, shouldReset, activeStageLabel } from "../life-cycle";

const dom = new JSDOM(readFileSync(resolve("dist/index.html"), "utf8"));
const doc = dom.window.document;

describe("life-cycle page: static contract", () => {
  it("has exactly one scrubber control", () => {
    expect(doc.querySelectorAll('input[type="range"]').length).toBe(1);
  });

  it("the scrubber has an accessible name", () => {
    const input = doc.querySelector('input[type="range"]')!;
    const labelled =
      input.hasAttribute("aria-label") ||
      Boolean(input.id && doc.querySelector(`label[for="${input.id}"]`));
    expect(labelled).toBe(true);
  });

  it("names the interactive art with an accessible name (it isn't an <img>)", () => {
    const svg = doc.querySelector('svg[role="img"]');
    expect(svg?.getAttribute("aria-label")).toBeTruthy();
  });

  it("exposes exactly the four life-cycle stages", () => {
    const stages = [...doc.querySelectorAll("[data-stage]")].map((el) => el.getAttribute("data-stage"));
    expect(new Set(stages)).toEqual(new Set(STAGES));
  });

  it("states the framing line once, before the interactive element", () => {
    const intro = doc.querySelector('[data-testid="intro"]');
    const input = doc.querySelector('input[type="range"]');
    expect(intro).toBeTruthy();
    expect(input).toBeTruthy();
    expect(intro!.compareDocumentPosition(input!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("life-cycle logic: pure functions", () => {
  it("blends between adjacent keyframes as progress advances", () => {
    const start = stageBlend(0);
    expect(start).toEqual({ from: 0, to: 1, localT: 0 });
    const mid = stageBlend(0.5);
    expect(mid.from).toBeGreaterThan(0);
    expect(mid.localT).toBeGreaterThan(0);
    expect(mid.localT).toBeLessThan(1);
  });

  it("changes a rendered visual parameter across the cycle", () => {
    expect(lerpParam("hueDeg", 0.05)).not.toBe(lerpParam("hueDeg", 0.95));
  });

  it("only requests a reset once progress reaches the maximum", () => {
    expect(shouldReset(9999, 10000)).toBe(false);
    expect(shouldReset(10000, 10000)).toBe(true);
  });

  it("has a caption for every stage, and none of them describe the reset", () => {
    for (const stage of STAGES) {
      expect(STAGE_INFO[stage].caption.length).toBeGreaterThan(0);
      expect(STAGE_INFO[stage].caption.toLowerCase()).not.toMatch(/polyp again|revert|reset|loop|repeat|immortal/);
    }
  });

  it("picks the stage whose blend weight currently dominates", () => {
    expect(activeStageLabel(0)).toBe("polyp");
    expect(activeStageLabel(0.999)).toBe("senescent");
  });
});
