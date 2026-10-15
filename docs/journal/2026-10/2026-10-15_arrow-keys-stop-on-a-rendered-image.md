---
title: "The arrow keys stop on a rendered image's line"
created: 2026-10-15
type: journal
parent: index
tags:
  - stylo
  - images
  - engineering
  - standard
---

# The arrow keys stop on a rendered image's line

## Context

The images slice left a gap in the in-place canvas: ArrowDown from the blank line above a rendered image, and ArrowUp from the blank line below, skipped the image's line, so its source was reachable only by a click beside the picture. A lone `![[ref]]` embed behaved the same way. The decision is an amendment to [ADR-014](../../decisions/014-image-source-for-markdown-images.md).

## What changed

- **`src/inplace/widget-line-keys.ts`** is a high-precedence keymap for ArrowUp and ArrowDown. When the next line is replaced by an image or a lone embed widget and the caret is on the last visual line of its own, it puts the caret on that line, keeping the column where it fits. The line then reveals its source through the existing caret rule, and the next arrow moves on.
- **The other four keys were checked and left alone.** ArrowLeft, ArrowRight, Backspace and Delete from the blank neighbour already land on the image's line.
- **Browser specs** cover both directions for an image, the four other keys, and an embed; a Vitest case pins the line lookup.
- **Follow-up: Ctrl-N and Ctrl-P on macOS** take the same stop, bound as macOS-only entries of the same keymap; the spec for them runs on macOS only. In `readOnly` the surface takes no focus, so the arrows never fire, and a spec pins that the picture stays. The ADR-014 amendment now names ADR-009, whose rollout log points to it.
