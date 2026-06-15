# Release Candidate Notes

## Classification

ship

## Included

- Local CLI and importable fixture-pack API.
- Dry-run JSON preview.
- Deterministic manifest, cases, checksums, and prompt files.
- Fixture-backed tests for extraction and write mode.
- Skill instructions and orchestration docs.

## Verification

Run:

```bash
npm test
npm run check
npm run smoke
npm run validate
```

## Reviewer Checklist

- Confirm dry-run output is deterministic JSON.
- Confirm write mode only creates files inside the requested output directory.
- Confirm generated prompts do not include private data before committing fixture packs.
