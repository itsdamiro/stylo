---
title: "Audit: is display-overriding-native-layout a recurring footgun beyond the table fixes?"
created: 2026-09-14
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Table-layout footgun audit

## Context

Two fixes landed back to back with the same root cause: a host tried to resize a rendered surface (the in-place editable table in `0.15.1`, then `preview`'s table in `0.15.2`) and the resize reached an outer box disconnected from the actual visible content — an in-flow padding reservation on one side, `display: block` silently disabling `<table>`'s own layout algorithm on the other. Worth checking, rather than assuming, whether this is a pattern recurring elsewhere in stylo's CSS before calling it closed.

## What was checked

Grepped both `src/styles/stylo.module.css` and every in-place `theme-*.ts` file for the two shapes the table bugs actually took:

- **`display` overriding a native element's own specialised layout algorithm.** `<table>` is the only element stylo renders with a browser-native formatting context (the CSS table layout algorithm) whose internal box can detach from an ancestor's box the way this bug exploited. No other `display:` rule in the sheet touches a `table`/`tr`/`td` (only the one now-fixed `.preview table` rule, and the new `.stylo-table-wrap`); every other `display` override in the in-place theme files targets ordinary block/flex/inline elements with no such native algorithm to disconnect from.
- **Every other `overflow-x: auto` scroll wrapper in the sheet** (`.toolbarSticky`, `.preview pre`, inline code, `.katex-display`) sits directly on a plain block box, not a specialised-layout element — there is no separate "internal grid" underneath any of them for a host's resize to miss, so direct styling there carries none of the table's risk.

## Conclusion

Not a systemic pattern — `<table>` was uniquely exposed because it's the only rendered element with its own native layout algorithm capable of running independently of its own CSS box. Both occurrences (in-place, `preview`) shared one root cause, and both are now fixed at the source; no further instances found to chase.

The broader, genuinely recurring shape across both bugs _is_ worth carrying forward as a standing check, not a CSS audit: **when a host needs to resize a surface stylo renders, verify with a real measurement that the override reaches the actual visible content, not a box one layer removed from it** — the same discipline `0.15.1` and `0.15.2` each already applied by measuring in a real Chromium rather than trusting `getBoundingClientRect()` on the outer element alone.
