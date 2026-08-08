import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { STAGES, STAGE_INFO, KEYFRAME_PARAMS, nextStage, isLoopTransition, blendParams } from "../life-cycle";

const dom = new JSDOM(readFileSync(resolve("dist/index.html"), "utf8"));
const doc = dom.window.document;

describe("life-cycle page: static contract", () => {
  it("has exactly one next-stage button", () => {
    expect(doc.querySelectorAll("#next-stage").length).toBe(1);
  });

  it("the next-stage button has a non-empty accessible name", () => {
    const button = doc.querySelector("#next-stage")!;
    expect(button.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("has an info button that opens a matching detail dialog", () => {
    const info = doc.querySelector("#info-toggle")!;
    expect(info.getAttribute("aria-controls")).toBe("stage-info");
    expect(doc.querySelector("#stage-info")).toBeTruthy();
  });

  it("ships a reference image for the stage dialog with alt text", () => {
    const photo = doc.querySelector<HTMLImageElement>("#stage-info-photo");
    expect(photo).toBeTruthy();
    expect(photo!.getAttribute("alt")?.trim().length).toBeGreaterThan(0);
    expect(photo!.getAttribute("src")).toMatch(/assets\/stages\/.+\.png$/);
  });

  it("credits the stage image as AI-generated and names a reference species", () => {
    const credit = doc.querySelector(".image-credit");
    expect(credit?.textContent?.toLowerCase()).toMatch(/ai-generated/);
    expect(doc.querySelector(".specimen-line")?.textContent).toMatch(/Reference species/i);
    expect(doc.querySelector("#stage-info-specimen")).toBeTruthy();
  });

  it("ships a rebirth explainer dialog unlocked after one cycle", () => {
    const toggle = doc.querySelector("#rebirth-toggle");
    const dialog = doc.querySelector("#rebirth-info");
    expect(toggle).toBeTruthy();
    expect(toggle?.getAttribute("aria-controls")).toBe("rebirth-info");
    expect(toggle?.hasAttribute("hidden")).toBe(true);
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent?.toLowerCase()).toMatch(/transdifferentiation|reverse development/);
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
    const button = doc.querySelector("#next-stage");
    expect(intro).toBeTruthy();
    expect(button).toBeTruthy();
    expect(intro!.compareDocumentPosition(button!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("life-cycle logic: pure functions", () => {
  it("steps through stages in order and wraps senescent back to polyp", () => {
    expect(nextStage("polyp")).toBe("young");
    expect(nextStage("young")).toBe("mature");
    expect(nextStage("mature")).toBe("senescent");
    expect(nextStage("senescent")).toBe("polyp");
  });

  it("flags only the wrap-around transition as a loop", () => {
    expect(isLoopTransition("senescent", "polyp")).toBe(true);
    expect(isLoopTransition("polyp", "young")).toBe(false);
    expect(isLoopTransition("mature", "senescent")).toBe(false);
  });

  it("blends a visual parameter between two named stages as progress advances", () => {
    expect(blendParams("polyp", "young", 0, "hueDeg")).toBeCloseTo(KEYFRAME_PARAMS.polyp.hueDeg);
    expect(blendParams("polyp", "young", 1, "hueDeg")).toBeCloseTo(KEYFRAME_PARAMS.young.hueDeg);
    const mid = blendParams("polyp", "young", 0.5, "hueDeg");
    expect(mid).not.toBe(KEYFRAME_PARAMS.polyp.hueDeg);
    expect(mid).not.toBe(KEYFRAME_PARAMS.young.hueDeg);
  });

  it("has a caption and detail for every stage, and none of them describe the reset", () => {
    for (const stage of STAGES) {
      expect(STAGE_INFO[stage].caption.length).toBeGreaterThan(0);
      expect(STAGE_INFO[stage].detail.length).toBeGreaterThan(0);
      const spoiler = /polyp again|revert|reset|loop|repeat|immortal/;
      expect(STAGE_INFO[stage].caption.toLowerCase()).not.toMatch(spoiler);
      expect(STAGE_INFO[stage].detail.toLowerCase()).not.toMatch(spoiler);
    }
  });

  it("names a real specimen stand-in and an image path for every stage", () => {
    for (const stage of STAGES) {
      const info = STAGE_INFO[stage];
      expect(info.specimen.length).toBeGreaterThan(0);
      expect(info.specimenNote.length).toBeGreaterThan(0);
      expect(info.image).toBe(`./assets/stages/${stage}.png`);
      expect(info.imageAlt.length).toBeGreaterThan(0);
    }
  });
});
