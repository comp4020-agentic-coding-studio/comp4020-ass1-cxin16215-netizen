"""Build swimming-loop GIFs for each life-cycle stage.

Camera stays fixed. Motion is on the animal only:
  - gentle vertical drift (swim bob)
  - bell pulse (vertical squeeze in the upper half)
  - tentacle sway (horizontal wave stronger toward the bottom)

No whole-frame zoom / camera pull.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = Path(
    r"C:\Users\c\.cursor\projects\c-Users-c-Desktop-comp4020-ass1-cxin16215-netizen-claude-worktrees-hashed-puzzling-barto\assets"
)
FALLBACK = ROOT / "assets" / "stages" / "frames"
OUT = ROOT / "public" / "assets" / "stages"
SIZE = 320
N_FRAMES = 12
DURATION_MS = 100

# Prefer freshly generated "a" stills; fall back to earlier f1 frames.
SOURCES: dict[str, tuple[str, ...]] = {
    "polyp": ("polyp-a.png", "polyp-f1.png"),
    "young": ("young-a.png", "young-f1.png"),
    "mature": ("mature-a.png", "mature-f1.png"),
    "senescent": ("senescent-a.png", "senescent-f1.png"),
}


def resolve_source(stage: str) -> Path:
    for name in SOURCES[stage]:
        for folder in (SRC_DIR, FALLBACK):
            path = folder / name
            if path.exists():
                return path
    raise SystemExit(f"no source still for {stage}")


def swim_frame(rgb: np.ndarray, t: float, *, polyp: bool) -> np.ndarray:
    """Warp one RGB array for progress t in [0, 1)."""
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)

    # Normalised coords from image centre.
    yn = (yy - (h - 1) / 2) / ((h - 1) / 2)
    xn = (xx - (w - 1) / 2) / ((w - 1) / 2)

    phase = t * math.tau
    if polyp:
        # Anchored sway: tentacle crown waves, almost no vertical travel.
        bob = 0.0
        pulse = 0.02 * math.sin(phase)
        sway = 0.05 * math.sin(phase)
        sway_falloff = np.clip((-yn + 0.2) / 1.2, 0.0, 1.0)  # stronger toward top crown
    else:
        # Free medusa: rise on the jet, fall while re-expanding; tentacles trail.
        bob = 0.08 * math.sin(phase)
        pulse = 0.11 * math.sin(phase)
        sway = 0.07 * math.sin(phase + 0.4)
        sway_falloff = np.clip((yn + 0.15) / 1.15, 0.0, 1.0)  # stronger toward tentacles

    # Bell pulse: squeeze/expand vertically more near the top of the animal.
    bell_weight = np.clip(1.0 - (yn + 1.0) * 0.55, 0.15, 1.0)
    y_src = yy + bob * h * 0.55 + pulse * bell_weight * yn * (h * 0.42)

    # Tentacle / crown sway: horizontal displacement grows away from the bell centre.
    x_src = xx + sway * sway_falloff * (h * 0.28) * (0.35 + 0.65 * np.abs(xn))

    # Soft secondary ripple along tentacles so they don't move as a rigid block.
    if not polyp:
        x_src = x_src + 0.02 * h * math.sin(phase * 2) * sway_falloff * np.sin(yn * 3.2)

    x0 = np.clip(np.floor(x_src).astype(np.int32), 0, w - 2)
    y0 = np.clip(np.floor(y_src).astype(np.int32), 0, h - 2)
    x1 = x0 + 1
    y1 = y0 + 1
    wx = x_src - x0
    wy = y_src - y0

    # Bilinear sample.
    out = np.empty_like(rgb)
    for c in range(3):
        Ia = rgb[:, :, c]
        top = Ia[y0, x0] * (1 - wx) + Ia[y0, x1] * wx
        bot = Ia[y1, x0] * (1 - wx) + Ia[y1, x1] * wx
        out[:, :, c] = top * (1 - wy) + bot * wy
    return out.astype(np.uint8)


def build_gif(stage: str) -> Path:
    src = resolve_source(stage)
    base = Image.open(src).convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    rgb = np.asarray(base, dtype=np.float32)
    polyp = stage == "polyp"

    frames: list[Image.Image] = []
    for i in range(N_FRAMES):
        t = i / N_FRAMES
        warped = swim_frame(rgb, t, polyp=polyp)
        frames.append(
            Image.fromarray(warped, mode="RGB").quantize(
                colors=96,
                method=Image.Quantize.MEDIANCUT,
            )
        )

    dest = OUT / f"{stage}.gif"
    frames[0].save(
        dest,
        save_all=True,
        append_images=frames[1:],
        duration=DURATION_MS,
        loop=0,
        optimize=True,
        disposal=2,
    )
    return dest


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for stage in SOURCES:
        dest = build_gif(stage)
        print(f"{stage}: {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB) from {resolve_source(stage).name}")


if __name__ == "__main__":
    main()
