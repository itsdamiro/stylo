#!/usr/bin/env python3
"""Fail on a relative Markdown link whose file, or whose #heading, does not exist.

Usage: python3 scripts/check_links.py [path ...]
A path is a Markdown file or a folder searched for *.md (default: the current folder). Hidden folders, node_modules
and symbolic links are skipped. A link with a scheme (https:, mailto:) is never fetched or checked; one that starts with
/ is read from the folder the script is run in, and one that starts with # is checked against the headings of its own file.
Reports `file:line: ...` for each broken link. Exits 1 if any, 2 if a path does not exist.

Checked: inline links and images, `[text](target "title")`, with the target in <angle brackets> or not.
Not checked: reference-style links, [[wikilinks]], HTML, and anything inside a code fence, a code span or frontmatter.
A heading's anchor follows GitHub: lower case, punctuation dropped, spaces to hyphens, a repeat numbered -1, -2.
"""

import os
import re
import sys
from collections.abc import Iterator
from urllib.parse import unquote

FENCE = re.compile(r"^\s*(`{3,}|~{3,})")
CODE_SPAN = re.compile(r"(`+)(?!`).+?(?<!`)\1(?!`)")
LINK = re.compile(r"\]\(\s*(<[^>]*>|[^)\s]*)(?:\s+(?:\"[^\"]*\"|'[^']*'))?\s*\)")
HEADING = re.compile(r"^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$")
SCHEME = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")
SKIPPED_DIRS = {"node_modules"}


def prose_lines(lines: list[str]) -> Iterator[tuple[int, str]]:
    """Yield (index, line) for every line outside frontmatter and code fences."""
    fence = ""
    frontmatter = bool(lines) and lines[0].rstrip() == "---"
    for i, raw in enumerate(lines):
        line = raw.rstrip("\n")
        if frontmatter:
            frontmatter = not (i > 0 and line.rstrip() in ("---", "..."))
            continue
        opened = FENCE.match(line)
        if fence:
            if opened and opened.group(1)[0] == fence[0] and len(opened.group(1)) >= len(fence) and not line.strip(" `~"):
                fence = ""
            continue
        if opened:
            fence = opened.group(1)
            continue
        yield i, line


def anchor(heading: str) -> str:
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", heading)  # a link in a heading counts as its text
    text = re.sub(r"[`*~]|</?[a-zA-Z][^>]*>", "", text).strip().lower()
    return re.sub(r"[^\w\- ]", "", text).replace(" ", "-")


def anchors(path: str, cache: dict[str, set[str]]) -> set[str]:
    if path not in cache:
        seen: dict[str, int] = {}
        found: set[str] = set()
        with open(path, encoding="utf-8") as f:
            for _, line in prose_lines(f.readlines()):
                if m := HEADING.match(line):
                    base = anchor(m.group(1))
                    n = seen.get(base, 0)
                    seen[base] = n + 1
                    found.add(base if n == 0 else f"{base}-{n}")
        cache[path] = found
    return cache[path]


def broken_links(path: str, cache: dict[str, set[str]]) -> Iterator[tuple[int, str]]:
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    for i, line in prose_lines(lines):
        for m in LINK.finditer(CODE_SPAN.sub(lambda m: " " * len(m.group(0)), line)):
            target = m.group(1).strip("<>")
            if not target or (SCHEME.match(target) and not target.startswith("/")):
                continue
            file_part, _, fragment = target.partition("#")
            if not file_part:
                dest = path
            elif file_part.startswith("/"):
                dest = os.path.normpath(unquote(file_part).lstrip("/"))
            else:
                dest = os.path.normpath(os.path.join(os.path.dirname(path), unquote(file_part)))
            if not os.path.exists(dest):
                yield i + 1, f"{target} does not exist"
            elif fragment and dest.endswith(".md") and os.path.isfile(dest):
                if unquote(fragment).lower() not in anchors(dest, cache):
                    yield i + 1, f"{target} has no such heading in {dest}"


def markdown_files(paths: list[str]) -> Iterator[str]:
    for path in paths:
        if os.path.isfile(path):
            yield path
            continue
        for root, dirs, files in os.walk(path):
            dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d not in SKIPPED_DIRS)
            yield from (p for f in sorted(files) if f.endswith(".md") and not os.path.islink(p := os.path.join(root, f)))


def main(paths: list[str]) -> int:
    missing = [p for p in paths if not os.path.exists(p)]
    if missing:  # a typo in the gate's command must not read as a pass
        print(f"no such file or folder: {', '.join(missing)}")
        return 2
    cache: dict[str, set[str]] = {}
    found = 0
    for path in markdown_files(paths or ["."]):
        for line, problem in broken_links(path, cache):
            print(f"{path}:{line}: {problem}")
            found += 1
    if found:
        print(f"{found} broken link(s).")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
