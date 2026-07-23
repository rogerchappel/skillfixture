# Changelog

## Unreleased

- Remove obsolete generated prompt files when regenerating a smaller fixture
  pack while preserving unrelated files in the output directory.
- Add a package lockfile and use reproducible `npm ci` installs in CI and
  release documentation.
- Replace raw package dry-run output with an assertion-backed package smoke
  check for the CLI, library, skill instructions, and support files.
- Add release-readiness docs for package reviewers.

## 0.1.0

- Initial local-first skill fixture generation CLI.
