# skillfixture

Use this skill when an agent needs to turn examples in a `SKILL.md` file into repeatable local fixtures for tests, demos, or regression checks.

## Required Inputs

- Path to a source `SKILL.md`.
- Optional output directory.

## Required Tools

- Local filesystem read access.
- Node.js 18 or newer.

## Side Effects

Dry-run mode only prints JSON. Write mode creates fixture files in the requested output directory and never calls external services.

## Approval Requirements

No approval is needed for dry-run previews. Ask the user before writing generated fixtures into a repository or overwriting an existing fixture directory.

## Examples

```bash
skillfixture SKILL.md --dry-run
skillfixture SKILL.md --out test/fixtures/generated
```

## Validation Workflow

Run `npm test`, `npm run check`, and `npm run smoke` after changing extraction behavior.

## Limitations

The extractor favors simple `## Examples` sections and fenced blocks. It does not infer expected assertions beyond deterministic metadata and manual-review markers.
