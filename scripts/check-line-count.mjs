/**
 * Guard for the 200-line ceiling on source files in `src/` (ADR-016).
 *
 * A `.ts` or `.tsx` file over 200 lines fails, unless it is in ALLOWLIST: a
 * path mapped to the length it may not exceed. The list only shrinks. A listed
 * file that grows fails; a listed file at 200 lines or fewer fails too, with a
 * message to delete its entry; an entry for a file that no longer exists fails.
 * The answer to a failure is to split the file, never to raise an entry.
 *
 * Lines are counted as `wc -l` counts them: the newline-terminated lines.
 */
import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const CEILING = 200

// Path (from the repo root) -> the length the file may not exceed.
const ALLOWLIST = {}

const root = fileURLToPath(new URL("..", import.meta.url))

async function* walk(dir) {
  for (const entry of await readdir(new URL(dir, `file://${root}/`), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) yield* walk(path)
    else if (/\.tsx?$/.test(entry.name)) yield path
  }
}

const countLines = (text) => text.split("\n").length - 1

const lengths = new Map()
for await (const path of walk("src")) {
  lengths.set(path, countLines(await readFile(`${root}/${path}`, "utf8")))
}

const problems = []
for (const [path, length] of [...lengths].sort()) {
  const limit = ALLOWLIST[path]
  if (limit === undefined) {
    if (length > CEILING)
      problems.push(`${path}: ${length} lines, over the ${CEILING}-line ceiling`)
  } else if (length > limit) {
    problems.push(`${path}: ${length} lines, over its allowlist entry of ${limit}`)
  } else if (length <= CEILING) {
    problems.push(`${path}: ${length} lines, now within the ceiling; delete its allowlist entry`)
  }
}
for (const path of Object.keys(ALLOWLIST)) {
  if (!lengths.has(path))
    problems.push(`${path}: in the allowlist but no longer exists; delete its entry`)
}

if (problems.length) {
  console.error(
    `✗ line-count check failed\n\n  ${problems.join("\n  ")}\n\n` +
      "  Source files in src/ stay at or under 200 lines (ADR-016). Split the file; do not raise an entry.",
  )
  process.exit(1)
}
console.log(
  `✓ every source file in src/ is within ${CEILING} lines (${Object.keys(ALLOWLIST).length} held on the allowlist)`,
)
