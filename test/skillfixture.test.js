import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

test("package metadata exposes the documented root library API", async () => {
  const metadata = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );

  assert.equal(metadata.type, "module");
  assert.equal(metadata.exports, "./src/index.js");
});

test("falls back to fenced blocks when no examples heading exists", () => {
  const pack = buildFixturePack("# Minimal\n\n```text\nCheck the repo\n```");
  assert.equal(pack.cases.length, 1);
  assert.deepEqual(pack.cases[0].expected, ["language:text", "manual-review"]);
});

test("extracts fenced examples from CRLF markdown", () => {
  const markdown = "# Windows Skill\r\n\r\n## Examples\r\n\r\n```text\r\nCheck the repo\r\n```\r\n";
  const pack = buildFixturePack(markdown);
  assert.equal(pack.cases.length, 1);
  assert.equal(pack.cases[0].prompt, "Check the repo");
  assert.deepEqual(pack.cases[0].expected, ["language:text", "manual-review"]);
});

test("extracts hyphenated fenced-example info strings", () => {
  const markdown = "# Shell Skill\n\n## Examples\n\n```shell-session\necho hello\n```\n";
  const pack = buildFixturePack(markdown);

  assert.equal(pack.cases.length, 1);
  assert.equal(pack.cases[0].prompt, "echo hello");
  assert.deepEqual(pack.cases[0].expected, ["language:shell-session", "manual-review"]);
});

test("extracts tilde-fenced examples with LF and CRLF parity", () => {
  for (const newline of ["\n", "\r\n"]) {
    const markdown = [
      "# Shell Skill",
      "",
      "## Examples",
      "",
      "~~~bash",
      "echo hello",
      "~~~",
      ""
    ].join(newline);
    const pack = buildFixturePack(markdown);

    assert.equal(pack.cases.length, 1);
    assert.equal(pack.cases[0].prompt, "echo hello");
    assert.deepEqual(pack.cases[0].expected, ["language:bash", "manual-review"]);
  }
});

test("ignores title and examples headings inside fenced blocks", () => {
  for (const [fence, info] of [["```", "markdown"], ["~~~", "md"]]) {
    for (const newline of ["\n", "\r\n"]) {
      const markdown = [
        `${fence}${info}`,
        "# Fenced Title",
        "## Examples",
        "- Fenced prompt",
        fence,
        "",
        "# Real Title",
        "",
        "## Examples",
        "",
        "- Real prompt",
        ""
      ].join(newline);
      const pack = buildFixturePack(markdown);

      assert.equal(pack.manifest.skillName, "Real Title");
      assert.deepEqual(pack.cases.map(({ prompt }) => prompt), ["Real prompt"]);
      assert.equal(pack.cases.some(({ prompt }) => prompt === "Fenced Title"), false);
      assert.equal(pack.cases.some(({ prompt }) => prompt === "Fenced prompt"), false);
    }
  }
});

test("normalizes optional closing sequences on ATX headings", () => {
  const markdown = [
    "# Demo Skill #",
    "",
    "## Examples ##",
    "",
    "- Prepare the release notes"
  ].join("\n");
  const pack = buildFixturePack(markdown);

  assert.equal(pack.manifest.skillName, "Demo Skill");
  assert.deepEqual(pack.cases.map(({ prompt }) => prompt), [
    "Prepare the release notes"
  ]);
});

test("preserves hashes that are not valid ATX closing sequences", () => {
  const markdown = [
    "# C# Skill#",
    "",
    "## Examples # notes",
    "- Ignored prompt",
    "",
    "## Examples",
    "",
    "- Kept # prompt"
  ].join("\n");
  const pack = buildFixturePack(markdown);

  assert.equal(pack.manifest.skillName, "C# Skill#");
  assert.deepEqual(pack.cases.map(({ prompt }) => prompt), ["Kept # prompt"]);
});

test("keeps closing-sequence headings fence-aware", () => {
  const markdown = [
    "```markdown",
    "# Fenced Title #",
    "## Examples ##",
    "- Fenced prompt",
    "```",
    "",
    "# Real Title #",
    "",
    "## Examples ##",
    "",
    "- Real prompt"
  ].join("\n");
  const pack = buildFixturePack(markdown);

  assert.equal(pack.manifest.skillName, "Real Title");
  assert.deepEqual(pack.cases.map(({ prompt }) => prompt), ["Real prompt"]);
});

test("ends examples at a following level-1 heading", () => {
  for (const newline of ["\n", "\r\n"]) {
    const markdown = [
      "# Demo Skill",
      "",
      "## Examples",
      "",
      "- Kept prompt",
      "",
      "# Appendix",
      "",
      "- Excluded note"
    ].join(newline);
    const pack = buildFixturePack(markdown);

    assert.deepEqual(pack.cases.map(({ prompt }) => prompt), ["Kept prompt"]);
  }
});

test("keeps nested level-3 content inside examples", () => {
  const markdown = [
    "# Demo Skill",
    "",
    "## Examples",
    "",
    "### Advanced",
    "",
    "```text",
    "Kept nested prompt",
    "```",
    "",
    "## Notes",
    "",
    "```text",
    "Excluded note",
    "```"
  ].join("\n");
  const pack = buildFixturePack(markdown);

  assert.deepEqual(pack.cases.map(({ prompt }) => prompt), [
    "Kept nested prompt"
  ]);
});

test("strips ordered-list markers from plain examples", () => {
  const markdown = [
    "# Ordered Skill",
    "",
    "## Examples",
    "",
    "1. First prompt",
    "12)   Second prompt"
  ].join("\n");
  const pack = buildFixturePack(markdown);

  assert.deepEqual(pack.cases.map(({ prompt }) => prompt), [
    "First prompt",
    "Second prompt"
  ]);
});

test("strips unordered-list markers from plain examples", () => {
  const markdown = [
    "# Unordered Skill",
    "",
    "## Examples",
    "",
    "- First prompt",
    "*  Second prompt",
    "+   Third prompt"
  ].join("\n");
  const pack = buildFixturePack(markdown);

  assert.deepEqual(pack.cases.map(({ prompt }) => prompt), [
    "First prompt",
    "Second prompt",
    "Third prompt"
  ]);
});

test("joins indented plain-list continuations and ignores surrounding prose", () => {
  for (const newline of ["\n", "\r\n"]) {
    const markdown = [
      "# Research Skill",
      "",
      "## Examples",
      "",
      "Use these examples as starting points:",
      "- Prepare a company brief",
      "  including risks and citations.",
      "2) Compare the leading vendors",
      "   across pricing and support.",
      "This section ends with explanatory prose."
    ].join(newline);
    const pack = buildFixturePack(markdown);

    assert.deepEqual(pack.cases.map(({ prompt }) => prompt), [
      "Prepare a company brief including risks and citations.",
      "Compare the leading vendors across pricing and support."
    ]);
  }
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

test("CLI dry-run joins plain-list continuations and excludes prose", async () => {
  const dir = await mkdtemp(join(tmpdir(), "skillfixture-"));
  const source = join(dir, "SKILL.md");
  try {
    await writeFile(source, [
      "# Demo",
      "",
      "## Examples",
      "",
      "Try this workflow:",
      "+ Inspect the release",
      "  for missing artifacts.",
      "Further guidance follows."
    ].join("\n"));

    const { stdout } = await execFileAsync("node", [
      "bin/skillfixture.js",
      source,
      "--dry-run"
    ]);
    const parsed = JSON.parse(stdout);

    assert.deepEqual(parsed.cases.map(({ prompt }) => prompt), [
      "Inspect the release for missing artifacts."
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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

test("CLI removes obsolete generated prompts when a fixture pack shrinks", async () => {
  const dir = await mkdtemp(join(tmpdir(), "skillfixture-"));
  const source = join(dir, "SKILL.md");
  const outDir = join(dir, "generated");
  try {
    await writeFile(source, "# Demo\n\n## Examples\n\n- First prompt\n- Second prompt\n");
    await execFileAsync("node", ["bin/skillfixture.js", source, "--out", outDir]);
    await writeFile(join(outDir, "review-notes.txt"), "keep me\n");

    await writeFile(source, "# Demo\n\n## Examples\n\n- First prompt\n");
    await execFileAsync("node", ["bin/skillfixture.js", source, "--out", outDir]);

    assert.deepEqual((await readdir(outDir)).sort(), [
      "case-01.prompt.txt",
      "cases.json",
      "manifest.json",
      "review-notes.txt"
    ]);
    assert.equal(await readFile(join(outDir, "review-notes.txt"), "utf8"), "keep me\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
