# skillfixture

`skillfixture` extracts examples from agent skill docs and turns them into deterministic fixture packs. It is useful when a skill has prose examples but no reusable regression data yet.

## Quickstart

```bash
npm install
npm test
node bin/skillfixture.js SKILL.md --dry-run
node bin/skillfixture.js SKILL.md --out test/fixtures/generated
```

Generated packs contain:

- `manifest.json` with source, skill name, case count, and checksum.
- `cases.json` with prompt cases and expected review markers.
- One prompt text file per case.

## Library API

```js
import { buildFixturePack } from "skillfixture";

const pack = buildFixturePack(markdown, { sourcePath: "SKILL.md" });
```

## Safety Notes

Dry-run mode performs local reads only. Write mode creates files in the requested directory and does not call APIs, publish data, or use credentials.

## Limitations

The first version extracts fenced blocks and simple example lists. Richer conventions can be added without changing the fixture schema.
