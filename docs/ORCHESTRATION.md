# Orchestration

Use `skillfixture` after drafting or updating a skill doc and before writing regression tests.

## Agent Flow

1. Run `skillfixture SKILL.md --dry-run` to preview extracted cases.
2. Review case prompts for private or unsuitable data.
3. Ask for approval before writing fixtures into the repository.
4. Write fixtures with `--out` and wire them into local tests or demos.

## Side-Effect Boundaries

Dry-run mode is read-only. Write mode only creates local files in the selected output directory. External service calls, package publishing, and live account writes are out of scope.
