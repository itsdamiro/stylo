# Browser tests

Playwright specs for the behaviour the Vitest + jsdom suite can't reach: the
in-place canvas is layout and pointer interaction — caret-driven marker reveal,
`coordsAtPos` click mapping, floating-popup positioning, the sticky-toolbar
`requestAnimationFrame` watchdog, real KaTeX rendering. Every one of those was
verified by hand against Chrome before this existed.

## Run

```bash
npx playwright install chromium   # once
npm run test:browser
```

`npm run test:browser` starts the Vite dev server on port 5199 itself (reusing
one already running outside CI) and drives
[`playground/fixture.html`](../../playground/fixture.html) — a bare mount of
`<Stylo>` whose config comes entirely from URL query params, so a spec is
deterministic and carries no playground chrome. The param list is documented at
the top of [`playground/fixture.tsx`](../../playground/fixture.tsx).

Useful flags: `--ui` (watch mode), `--headed`, `--debug`, `-g "<name>"`.

## Layout

| File                        | Covers                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `in-place-canvas.spec.ts`   | heading scale, `reveal="caret"` marker show/hide, emphasis markers hidden off-caret                                                     |
| `selection-bar.spec.ts`     | `selectionUI="bar"` appears on selection and on-screen; yields while the right-click menu is open                                       |
| `context-menu.spec.ts`      | opens on right-click, clamps to the viewport near an edge, dismisses on outside click                                                   |
| `sticky-toolbar.spec.ts`    | `toolbar={{ sticky: "top" }}` stays pinned through a window scroll                                                                      |
| `math.spec.ts`              | KaTeX renders with real dimensions in `preview` and in-place                                                                            |
| `wikilink-complete.spec.ts` | `wikiLinkSource` popup opens inside `[[`, accept inserts a closed link, absent without the prop                                         |
| `image.spec.ts`             | `imageSource`: the canvas draws a lone image, the host's size suffix applies, the caret reveals the source, `preview` and `split` match |

`_fixture.ts` is the shared helper (not a spec — `testMatch` is `*.spec.ts`).

## Adding a test

Prefer web-first assertions (`expect(locator).toBeVisible()`, `expect.poll`) over
`waitForTimeout`. If a new scenario needs a config the fixture doesn't expose,
add a query param there rather than building a bespoke page.
