import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFixturePack } from "../src/index.js";

const execFileAsync = promisify(execFile);

test("builds deterministic cases from skill examples", async () => {
  const markdown = await readFile(new URL("./fixtures/source/SKILL.md", import.meta.url), "utf8");
  const pack = buildFixturePack(markdown, { sourcePath: "fixture/SKILL.md" });
  assert.equal(pack.manifest.skillName, "Demo Research Skill");
  assert.equal(pack.manifest.caseCount, 2);
  assert.equal(pack.cases[0].id, "case-01");
  assert.match(pack.cases[0].prompt, /Prepare a company brief/);
});

test("falls back to fenced blocks when no examples heading exists", () => {
  const pack = buildFixturePack("# Minimal\n\n```text\nCheck the repo\n```");
  assert.equal(pack.cases.length, 1);
  assert.deepEqual(pack.cases[0].expected, ["language:text", "manual-review"]);
});

test("CLI dry-run prints fixture JSON", async () => {
  const { stdout } = await execFileAsync("node", [
    "bin/skillfixture.js",
    "test/fixtures/source/SKILL.md",
    "--dry-run"
  ]);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.manifest.caseCount, 2);
});

test("CLI writes fixture pack files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "skillfixture-"));
  try {
    await execFileAsync("node", [
      "bin/skillfixture.js",
      "test/fixtures/source/SKILL.md",
      "--out",
      dir
    ]);
    const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    const cases = JSON.parse(await readFile(join(dir, "cases.json"), "utf8"));
    const prompt = await readFile(join(dir, "case-01.prompt.txt"), "utf8");
    assert.equal(manifest.caseCount, 2);
    assert.equal(cases.length, 2);
    assert.match(prompt, /Prepare a company brief/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
