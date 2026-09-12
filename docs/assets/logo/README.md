---
title: Brand Assets
doc_id: DOC-007
version: 0.21.0
status: Draft
last_updated: 2026-09-12
owners: [platform-architecture]
---

# Brand Assets

The Orchestra mark, the wordmark, and when to use which file.

## The mark

**A ring with a gate on it.** The ring is a Run moving through its lifecycle; the diamond is the
enforcement point every step passes through. The diamond is the decision shape used in the
documentation's diagrams, so the mark states the product's thesis — governed at every step — and
reads as an **O** for Orchestra.

Four placements were drawn and rejected before this one, each for a meaning it borrowed: a gap at
twelve o'clock is a power button, a gap at one or two o'clock reads as a refresh icon at small
sizes, and a gap at three o'clock is the letter C. The ring stays whole, and the separation around
the gate is a transparent cut, so the mark sits correctly on any background.

## Files

| File | Use it for |
| --- | --- |
| [`orchestra-mark.svg`](orchestra-mark.svg) | The app icon: avatars, social profiles, anywhere a square is needed |
| [`orchestra-lockup-light.svg`](orchestra-lockup-light.svg) | Mark and wordmark on a light background |
| [`orchestra-lockup-dark.svg`](orchestra-lockup-dark.svg) | Mark and wordmark on a dark background |
| [`orchestra-glyph-blue.svg`](orchestra-glyph-blue.svg) | The mark without its tile, on a light background |
| [`orchestra-glyph-white.svg`](orchestra-glyph-white.svg) | The mark without its tile, on a dark or photographic background |
| [`favicon.svg`](favicon.svg) | Browser tabs. Heavier strokes than the mark, drawn to survive 16 pixels |
| [`png/`](png/) | Rasters where SVG is not accepted — the mark at 1024, 512, 180 and 32 pixels, both lockups, a 400-pixel LinkedIn avatar and a 1200 by 627 LinkedIn post image |

The published documentation site uses the two lockups and the favicon, configured in
[`../../docs.json`](../../docs.json) by `scripts/build-docs-nav.mjs`.

## Colour

**Dark, shiny blue.** The tile carries a gradient and a soft highlight in its top-left corner, which
is where the shine comes from; the flat primary is what text, links and buttons use.

| Role | Value |
| --- | --- |
| Primary | `#10218b` — a deep indigo blue, about 13:1 contrast on white, so it is safe for links, buttons and body text |
| Tile gradient | `#2340d6` to `#10218b` to `#081149`, top left to bottom right — the primary sits at its centre |
| Tile highlight | White at 30 percent opacity, fading out from the top-left corner |
| Accent on dark | `#7b8bf4` — about 6:1 contrast on the ink |
| Ink | `#0b1220` |
| On dark | `#ffffff` |

The green in the documentation's diagrams is not the brand: in the ADR dependency graph it means
**Accepted**, beside amber for Proposed and grey for Superseded, and it stays that way.

## Type

The wordmark is **Inter SemiBold**, licensed under the SIL Open Font License 1.1, set with Inter's
own kerning and tightened by a little over one percent. It is converted to outlines, so it renders
identically without the font installed. Never retype it in live text or another face.

## Rules

- **Clear space:** keep at least a quarter of the tile's height free on every side.
- **Minimum size:** 16 pixels for the favicon, and a lockup no shorter than 20 pixels.
- **Do not** rotate the mark, move the gate to another position, or recolour the gate separately
  from the ring.
- **Do not** put the blue glyph on a blue or busy background — use the white glyph or the tile.
