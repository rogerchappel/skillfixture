# skillfixture

`skillfixture` extracts examples from agent skill docs and turns them into deterministic fixture packs. It is useful when a skill has prose examples but no reusable regression data yet.

## Quickstart

```bash
npm ci
npm test
node bin/skillfixture.js --version
node bin/skillfixture.js SKILL.md --dry-run
node bin/skillfixture.js SKILL.md --out test/fixtures/generated
```

Options may appear before or after `SKILL.md`. Unknown options, repeated
`--dry-run` or `--out` options, missing `--out` values, and extra input paths
are rejected before the CLI reads or writes files.

Generated packs contain:

- `manifest.json` with source, skill name, case count, and checksum.
- `cases.json` with prompt cases and expected review markers.
- One prompt text file per case.

Regenerating into the same directory removes prompt files represented by the
previous `cases.json` when those cases no longer exist. Other files in the
directory are left untouched.

## Library API

```js
import { buildFixturePack } from "skillfixture";

const pack = buildFixturePack(markdown, { sourcePath: "SKILL.md" });
```

## Safety Notes

Dry-run mode performs local reads only. Write mode creates files in the requested directory and does not call APIs, publish data, or use credentials.

## Limitations

The first version extracts CommonMark-style backtick and tilde fenced blocks,
using the first word of an optional info string as the language marker. Empty
or whitespace-only fenced blocks are ignored and do not generate cases or
prompt files; later non-empty blocks keep their original language markers and
deterministic case numbering. Plain
lists may use `-`, `*`, or `+` unordered markers, or numeric ordered markers
such as `1.` and `2)`. Indented continuation lines are joined to the preceding
list item; introductory and trailing prose outside the list is not extracted.
Skill titles and `Examples` section headings are only recognized outside valid
backtick or tilde fences. Both ATX headings (`# Demo Skill`, `## Examples`) and
setext headings (a title underlined with `=`, or `Example`/`Examples` underlined
with `-`) are supported. ATX headings may include an optional closing sequence,
such as `# Demo Skill #` or `## Examples ##`. Heading content and setext
underlines may be indented by up to three spaces; four-space indentation is
treated as code, not a heading.
Heading-like sample text inside a fenced block does not affect document
structure. If a fence is not closed, its remaining content is not interpreted
as plain-list fixtures. An `Examples` section continues through nested headings
and ends at the next heading of equal or higher rank (for `## Examples`, the
next `#` or `##` heading). Document-wide fenced blocks are used only when no
`Example` or `Examples` section heading exists. A present section that is empty,
contains prose without list items, or starts an unclosed fence produces zero
cases instead of importing fences from elsewhere in the document. Richer
conventions can be added without changing the fixture schema.

## Verification

```bash
npm ci
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
```

Use `npm run release:check` before publishing or opening a release PR.
See [docs/release-readiness.md](docs/release-readiness.md) for the package
surface, release gate, and reviewer checklist.
