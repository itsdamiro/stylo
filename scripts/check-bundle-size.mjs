/**
 * Bundle-size guard. "Zero-bloat" is the pitch, so a chunk that balloons should
 * fail CI, not be noticed months later. Run after `npm run build`.
 *
 * Budgets are gzipped bytes, per chunk, matched by filename prefix (chunks are
 * content-hashed). A legitimate increase means bumping the number here in the
 * same commit — deliberately.
 */
import { gzipSync } from "node:zlib"
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const dist = fileURLToPath(new URL("../dist/", import.meta.url))

/** prefix -> max gzipped bytes */
const BUDGETS = {
  "stylo.js": 6_000, // entry, always loaded — keep it tiny. Bumped from 4,000: the
  // toolbar overflow menu (fit, hook, menu) adds ~2,000 B and lives in the bar
  InPlaceView: 24_000, // in-place canvas glue — bumped from 22,000, then 23,000: the readOnly
  // table-cell guard and the exitBelow / insertTable fixes (2026-09-13) left only
  // 27 B of headroom; host items in the context menu (2026-10-05) add ~630 B
  Preview: 4_000, // preview glue
  katex: 95_000, // math rendering
  markdown: 70_000, // remark / rehype / react-markdown — preview only
  useCodeMirror: 13_000, // editor glue shared by every CodeMirror surface
  config: 3_000, // toolbar glyphs, labels, and item config — shared by the bar and the customizer
  "toolbar-settings": 5_000, // the opt-in <StyloToolbarSettings /> entry (@damiro/stylo/toolbar-settings)
  wikilink: 2_000,
  callout: 2_000,
  embed: 2_000, // <Embed> — the ![[ref]] resolver shared by preview and the in-place canvas
  highlight: 2_000, // SYNTAX_TAG_GROUPS + styloHighlightStyle — shared by the in-place canvas and preview's highlightCode.ts
  frontmatter: 2_000, // frontmatterRange / splitFrontmatter — shared by the entry, in-place, and preview
}

// CodeMirror and Lezer are peer dependencies (ADR-008) — externalised from the
// bundle, so there is no CM chunk to budget here. A regression to that shows up
// as a new unbudgeted chunk, which this script already fails on.

const files = (await readdir(dist)).filter((f) => f.endsWith(".js"))
const rows = []
const over = []

for (const f of files) {
  const prefix = Object.keys(BUDGETS).find((p) => f === p || f.startsWith(p.replace(/\.js$/, "")))
  const gz = gzipSync(await readFile(dist + f)).length
  if (!prefix) {
    over.push(`  ${f} — no budget entry (add one to scripts/check-bundle-size.mjs)`)
    continue
  }
  const max = BUDGETS[prefix]
  rows.push({ f, gz, max, ok: gz <= max })
  if (gz > max) over.push(`  ${f} — ${gz} B gzip > ${max} B budget (${prefix})`)
}

for (const { f, gz, max, ok } of rows.sort((a, b) => b.gz - a.gz)) {
  console.log(`${ok ? "  " : "✗ "}${f.padEnd(28)} ${String(gz).padStart(7)} B  / ${max} B`)
}

if (over.length) {
  console.error(`\n✗ bundle-size check failed\n${over.join("\n")}\n`)
  process.exit(1)
}
console.log(`\n✓ ${rows.length} chunks within budget`)
