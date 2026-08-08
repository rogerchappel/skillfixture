# Release Readiness

Use this checklist before publishing, tagging, or asking reviewers to trust a
`skillfixture` release.

## Package Surface

- CLI bin: `skillfixture` -> `bin/skillfixture.js`
- Library entry: the package root exports `src/index.js` for ESM consumers.
- Skill instructions: `SKILL.md`
- Support files: README, changelog, license, security policy, and contributing
  guide.

## Verification Commands

- `npm ci`: performs the lockfile-backed clean install used by CI.
- `npm run check`: syntax-checks the CLI and library.
- `npm test`: runs fixture-backed Node tests.
- `npm run smoke`: exercises the CLI against the source fixture skill.
- `npm run package:smoke`: builds the release tarball, asserts required files
  are present, installs it into an isolated consumer, and exercises the
  documented package-root import.
- `npm run release:check`: runs the full release gate used by CI.

## Reviewer Notes

- Confirm README examples still match the `skillfixture` bin and dry-run/write
  modes.
- Confirm the package-root `buildFixturePack` import works from the packed
  artifact, not only from the source checkout.
- Inspect package-smoke output for unexpected generated fixture directories.
- Keep private prompts, customer skills, and unpublished evaluation material out
  of public fixtures and issues.
