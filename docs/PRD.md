# PRD: skillfixture

## Goal

Help agent skill authors convert examples into repeatable local fixtures.

## Users

- Skill authors adding tests.
- Review agents checking that examples are preserved.
- Release lanes that need deterministic demo inputs.

## Requirements

- Parse a local `SKILL.md` file.
- Prefer examples under a `## Examples` heading.
- Fall back to fenced blocks when no examples section exists.
- Emit a manifest, case list, and prompt files.
- Support dry-run previews before writing files.
- Avoid network access and external side effects.

## Success Metrics

- Example fixtures produce stable checksums.
- CLI dry-run is valid JSON.
- Write mode creates all expected files in a temporary directory during tests.
