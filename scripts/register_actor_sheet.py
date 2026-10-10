#!/usr/bin/env python3
"""Register an RGBA actor atlas by its visible-alpha grid, never by equal tiles.

Requires Pillow and numpy. RGB and alpha in each crop are kept unchanged; resizing
uses nearest neighbour. Low-alpha generator noise does not define the grid.
"""

import argparse
import json
import math
from pathlib import Path
import sys

import numpy as np
from PIL import Image


def occupied_bands(counts, threshold=3, join=3):
    """Return substantive occupied spans, joining at most three empty pixels."""
    indexes = np.flatnonzero(counts >= threshold)
    if not len(indexes):
        return []
    chunks = np.split(indexes, np.flatnonzero(np.diff(indexes) > join + 1) + 1)
    return [(int(part[0]), int(part[-1]) + 1) for part in chunks]


def grid_regions(spans, extent):
    """Put separators inside the measured gaps, not at width / column_count."""
    cuts = [0]
    cuts.extend((left[1] + right[0]) // 2 for left, right in zip(spans, spans[1:]))
    cuts.append(extent)
    return list(zip(cuts, cuts[1:]))


def parse_grid(value):
    if value not in {"4x4", "2x2"}:
        raise argparse.ArgumentTypeError("--grid must be 4x4 or 2x2")
    cols, rows = map(int, value.split("x"))
    return cols, rows


def register(args):
    source = Path(args.sheet).expanduser().resolve()
    out = Path(args.out).expanduser().resolve()
    if not source.is_file():
        raise ValueError(f"Sheet does not exist: {source}")
    if not (0 < args.baseline < args.canvas):
        raise ValueError("--baseline must be positive and below --canvas")
    if not (1 <= args.alpha_threshold <= 254):
        raise ValueError("--alpha-threshold must be between 1 and 254")
    if args.padding < 0:
        raise ValueError("--padding cannot be negative")
    cols, rows = args.grid
    with Image.open(source) as original:
        if "A" not in original.getbands() and "transparency" not in original.info:
            raise ValueError("Sheet has no alpha channel. Regenerate with transparent_background=true; white backgrounds are not removed automatically.")
        sheet = original.convert("RGBA")
    rgba = np.asarray(sheet)
    alpha = rgba[:, :, 3]
    if not np.any(alpha == 0):
        raise ValueError("Sheet has no fully transparent pixels. A solid background cannot be split safely; regenerate an RGBA atlas.")
    core = alpha > args.alpha_threshold
    row_bands = occupied_bands(core.sum(axis=1))
    col_bands = occupied_bands(core.sum(axis=0))
    if len(row_bands) != rows or len(col_bands) != cols:
        raise ValueError(f"Alpha gaps do not identify a {cols}x{rows} grid: rows={row_bands}, columns={col_bands}. Regenerate with larger transparent gutters; the script will not equally slice or erase the background.")
    row_regions = grid_regions(row_bands, sheet.height)
    col_regions = grid_regions(col_bands, sheet.width)
    cells = []
    for row, (top, bottom) in enumerate(row_regions):
        for col, (left, right) in enumerate(col_regions):
            region_mask = core[top:bottom, left:right]
            yy, xx = np.where(region_mask)
            if not len(xx):
                raise ValueError(f"Empty visible-alpha cell at row {row}, column {col}")
            # Never crop substantive actor pixels. Keep original RGBA, including
            # semi-transparent edge pixels in the padded crop. Alpha threshold
            # defines detection only; it is not applied to the output image.
            core_box = (left + int(xx.min()), top + int(yy.min()),
                        left + int(xx.max()) + 1, top + int(yy.max()) + 1)
            crop_box = (max(left, core_box[0] - args.padding),
                        max(top, core_box[1] - args.padding),
                        min(right, core_box[2] + args.padding),
                        min(bottom, core_box[3] + args.padding))
            cell = sheet.crop(crop_box)
            anchor_x = (core_box[0] + core_box[2]) / 2 - crop_box[0]
            anchor_y = core_box[3] - crop_box[1]
            cells.append({"image": cell, "row": row, "column": col,
                          "region": [left, top, right, bottom],
                          "crop": crop_box, "core": core_box,
                          "anchor": [anchor_x, anchor_y]})
    heights = [cell["core"][3] - cell["core"][1] for cell in cells]
    height_ratio = max(heights) / min(heights)
    if height_ratio > 1.5:
        raise ValueError(f"Actor silhouette heights differ by {height_ratio:.2f}x ({min(heights)}…{max(heights)} px). Regenerate consistent character sizes; individual per-frame scaling would hide the inconsistency.")
    # One factor for the complete group, including gestures with extended arms.
    # Anchors are silhouette bottom (feet / waist), not bottom of padded PNG.
    margin = 6
    allowed = []
    for cell in cells:
        width, height = cell["image"].size
        ax, ay = cell["anchor"]
        allowed.extend([(args.canvas / 2 - margin) / max(ax, width - ax),
                        (args.baseline - margin) / ay])
        if height > ay:
            allowed.append((args.canvas - args.baseline - margin) / (height - ay))
    scale = min(allowed)
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError("Canvas / baseline does not leave room for transparent padding")
    rendered = []
    for i, cell in enumerate(cells):
        image = cell["image"]
        size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        scaled = image.resize(size, Image.Resampling.NEAREST)
        # Detect final significant-alpha boundaries after discrete pixel resize,
        # aligning every core bottom exactly to the requested baseline.
        visible = np.asarray(scaled)[:, :, 3] > args.alpha_threshold
        yy, xx = np.where(visible)
        x = round(args.canvas / 2 - (int(xx.min()) + int(xx.max()) + 1) / 2)
        y = args.baseline - (int(yy.max()) + 1)
        if x < 0 or y < 0 or x + size[0] > args.canvas or y + size[1] > args.canvas:
            raise ValueError(f"Frame {i:02d} exceeds the canvas after registration. Increase the canvas or adjust baseline / padding.")
        canvas = Image.new("RGBA", (args.canvas, args.canvas), (0, 0, 0, 0))
        # A direct paste keeps stored RGB and alpha intact (no mask, composite,
        # quantization, colour conversion, or silhouette repaint).
        canvas.paste(scaled, (x, y))
        rendered.append((canvas, {"frame": i, "file": f"{i:02d}.png",
            "row": cell["row"], "column": cell["column"],
            "sourceRegion": cell["region"], "sourceCrop": list(cell["crop"]),
            "sourceCoreBox": list(cell["core"]),
            "outputBox": [x, y, *size],
            "outputCoreBox": [x + int(xx.min()), y + int(yy.min()),
                              x + int(xx.max()) + 1, args.baseline]}))
    # Validate everything before creating output files. An existing registration
    # is never overwritten silently, so repeated runs cannot mix old new frames.
    if out.exists() and any(out.iterdir()):
        raise ValueError(f"Output directory is not empty: {out}. Use a fresh directory.")
    out.mkdir(parents=True, exist_ok=True)
    for canvas, frame in rendered:
        canvas.save(out / frame["file"])
    manifest = {"schemaVersion": 1, "source": str(source),
        "sourceSize": [sheet.width, sheet.height], "layout": [cols, rows],
        "kind": "mini" if rows == 4 else "portrait",
        "canvas": [args.canvas, args.canvas], "anchor": [args.canvas / 2, args.baseline],
        "baseline": args.baseline, "uniformScale": scale,
        "alphaThreshold": args.alpha_threshold, "cropPadding": args.padding,
        "coreHeightRatio": height_ratio,
        "alphaPolicy": "alpha threshold detects visible silhouette only; nearest-neighbour preserves RGBA inside each padded crop, no background removal",
        "rowBands": row_bands, "columnBands": col_bands,
        "frames": [frame for _, frame in rendered]}
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"output": str(out), "count": len(rendered), "canvas": args.canvas,
            "baseline": args.baseline, "uniformScale": scale,
            "rowBands": row_bands, "columnBands": col_bands}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sheet", required=True)
    parser.add_argument("--grid", required=True, type=parse_grid)
    parser.add_argument("--canvas", required=True, type=int, choices=[256, 512])
    parser.add_argument("--baseline", required=True, type=int)
    parser.add_argument("--out", required=True)
    parser.add_argument("--alpha-threshold", type=int, default=128,
                        help="Detection threshold only; output alpha is unchanged (default: 128)")
    parser.add_argument("--padding", type=int, default=3,
                        help="Original RGBA margin around substantive silhouette (default: 3)")
    try:
        print(json.dumps(register(parser.parse_args()), ensure_ascii=False))
    except (ValueError, OSError) as error:
        print(f"Registration failed: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
