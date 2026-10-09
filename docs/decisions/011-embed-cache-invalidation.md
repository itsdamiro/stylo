---
type: decision
status: accepted
date: 2026-09-17
projects: [stylo]
concepts: [Host integration]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 011 — Embed cache invalidation: a host-triggered `invalidateEmbed`

> **Summary.** The host calls `invalidateEmbed(ref?)` on the public handle to drop one cached embed or all of a source's, because the cache otherwise keeps a settled entry forever. Stylo cannot know when the content behind a reference changes. The cache module now loads eagerly, a net new eager cost of about 1.5 kB gzipped on every mount, judged acceptable for putting the call on the handle a host already holds.

- **Status:** Accepted — implemented same day.
- **Date:** 2026-09-17
- **Deciders:** damiro, Grace

## Context

`embed-cache.ts` caches every `![[ref]]` resolution forever, keyed by `embedSource` identity and the raw `ref` string, with only a 64-entry insertion-order cap for eviction (flagged as Tier 5 of the [2026-09-17 codebase review](../journal/2026-09/2026-09-17_full-codebase-review-findings.md)). That is exactly what makes scrolling an embed out of view and back, or a `preview` remount, cheap — but it also means the cache never re-checks a settled entry on its own. If the content behind a reference changes while the editor stays open, the stale pre-edit render shows indefinitely; nothing in the cache's design gives it a way to know otherwise.

## Decision

Add `invalidateEmbed(source, ref?)` to `embed-cache.ts`, dropping the cached entry for one `ref` (or, with no `ref`, every entry for that `embedSource`), and expose it on the public handle as `StyloHandle.invalidateEmbed(ref?)`. The host calls it when it knows a reference's content changed; Stylo has no way to detect that on its own.

- **Listener set, not just deletion.** An `Embed` already rendered for the invalidated `ref` needs to update immediately, not just on its next mount — a mount-only fix would leave an on-screen embed stale until something else happened to remount it. `onEmbedInvalidated(source, ref, listener)` lets `Embed`'s own mount effect subscribe for exactly its `(source, ref)` pair; `invalidateEmbed` notifies that pair's listeners synchronously after clearing the entry. `Embed`'s `useEffect` now names its resolve/peek logic as a `load` closure so both the initial mount and an invalidation notification call the same path.
- **On the handle, not a prop.** `invalidateEmbed` is an action ("this changed, forget it"), not configuration — it belongs with `focus` / `insertAtCursor` / `scrollToHeading` on the imperative handle, not as a new `StyloProps` field. `Stylo.tsx` reads the live `embedSource` through a ref (`embedSourceRef`, set unconditionally on every render, same pattern as `onFrontmatterRef` / `onResolveErrorRef`) so the imperative handle itself doesn't need rebuilding when `embedSource` changes.
- **Works in every mode, including `preview`.** Every other `StyloHandle` method is a no-op without a mounted editor. `invalidateEmbed` targets the embed cache, not the editor, so it works whenever `embedSource` is set, `preview` included — documented as the one exception on the interface.

### Alternatives rejected

- **A TTL (time-to-live) per entry.** Rejected as a guess dressed up as a fix — it doesn't answer "is this still correct," it just picks a window and hopes nothing changed inside it. Whatever number gets chosen is either too short (refetching when nothing changed) or too long (showing stale content anyway for part of the window).
- **A version/timestamp folded into the cache key** (e.g. resolving `"ref@v3"` instead of `"ref"`). Rejected for now: it's only as good as a version signal the host already has lying around, and inventing one just for this would be the over-engineering the project explicitly avoids. A host that already tracks `updatedAt` per note can still get the same effect today by varying the `ref` string it passes, or can ask for this to be revisited if the plain invalidate call proves insufficient.

## Consequences

### Positive

- Closes the one designed-in staleness gap in the embed cache without guessing at a TTL or inventing a versioning scheme the codebase has no other use for.
- One new function on an interface hosts already hold a reference to — no new prop, no change to `EmbedSource`'s signature, no migration for existing consumers.
- `Embed`'s subscribe/notify path is a handful of lines reusing patterns already in the file (a `WeakMap` bucket keyed by resolver identity, same as the cache itself).

### Costs / considerations

- **`embed-cache.ts` is no longer purely lazy.** `Stylo.tsx` (always eagerly loaded) now statically imports it, so it moved from being bundled only inside the lazy `preview` / `in-place` chunks to also being loaded eagerly alongside the main entry. Bundle cost, measured (`npm run check:size`, gzip): `stylo.js` +116 B (3,536 B → 3,652 B / 4,000 B budget); the `embed` chunk that used to hold `Embed.tsx` and the cache together (1,200 B) split into `embed` (1,018 B, `Embed.tsx` alone, still fully lazy) and a new `embed-cache` chunk (1,537 B, now eagerly loaded) — a net new eager cost of ~1.5 KB gzip on every mount, paid whether or not the host uses embeds at all. Both chunks stay well inside their 2,000 B budget; no budget bump needed. Judged an acceptable trade for putting the invalidation call where a host would actually look for it (the handle it already holds), rather than a free function importable only by consumers who dig for it in the module graph.
- Still no automatic staleness detection — `invalidateEmbed` only helps a host that actually calls it. A host that never calls it sees exactly today's behavior (cache forever), which was already true and not a regression.

## Rollout log

**Implemented directly, no deferral.** `test/embed-cache.test.ts` covers `invalidateEmbed` (single ref, no-ref-clears-all, no-op on an untouched source) and `onEmbedInvalidated` (notifies, unsubscribes, scoped to its own ref). `test/imperative.test.tsx` covers the public surface end to end through `<Stylo mode="preview">`: an already-rendered embed re-resolves and updates its content after `invalidateEmbed(ref)`; `invalidateEmbed()` with no argument re-resolves every embed for the source; the method is a no-op without `embedSource` set, in every mode.
