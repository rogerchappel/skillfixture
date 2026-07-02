# Release Readiness

Use this checklist before publishing, tagging, or asking reviewers to trust a
`skillfixture` release.

## Package Surface

- CLI bin: `skillfixture` -> `bin/skillfixture.js`
- Library entry: `src/index.js`
- Skill instructions: `SKILL.md`
- Support files: README, changelog, license, security policy, and contributing
  guide.

## Verification Commands

- `npm run check`: syntax-checks the CLI and library.
- `npm test`: runs fixture-backed Node tests.
- `npm run smoke`: exercises the CLI against the source fixture skill.
- `npm run package:smoke`: dry-runs `npm pack` and asserts required release
  files are present.
- `npm run release:check`: runs the full release gate used by CI.

## Reviewer Notes

- Confirm README examples still match the `skillfixture` bin and dry-run/write
  modes.
- Inspect package-smoke output for unexpected generated fixture directories.
- Keep private prompts, customer skills, and unpublished evaluation material out
  of public fixtures and issues.
