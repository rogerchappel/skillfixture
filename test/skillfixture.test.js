import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFixturePack } from "../src/index.js";

const execFileAsync = promisify(execFile);

async function assertCliUsageError(args, message) {
  await assert.rejects(
    execFileAsync("node", ["bin/skillfixture.js", ...args]),
    (error) => {
      assert.equal(error.code, 2);
      assert.equal(error.stdout, "");
      assert.equal(error.stderr, `skillfixture: ${message}\n`);
      return true;
    }
  );
}

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

test("skips empty fenced examples in sections and document-wide fallback", () => {
  for (const newline of ["\n", "\r\n"]) {
    for (const scoped of [false, true]) {
      const lines = ["# Minimal", ""];
      if (scoped) lines.push("## Examples", "");
      lines.push("```text", "   ", "```", "", "~~~shell-session", "echo hello", "~~~");
      const pack = buildFixturePack(lines.join(newline));

      assert.equal(pack.manifest.caseCount, 1);
      assert.equal(pack.cases[0].id, "case-01");
      assert.equal(pack.cases[0].prompt, "echo hello");
      assert.deepEqual(pack.cases[0].expected, ["language:shell-session", "manual-review"]);
      assert.equal(pack.cases[0].hash, "40a4976465231164");
      assert.deepEqual(pack.files, [{ name: "case-01.prompt.txt", content: "echo hello\n" }]);
    }
  }
});

test("does not fall back outside a present examples section", () => {
  const sectionBodies = [
    [],
    ["This section intentionally contains no fixture cases."],
    ["```text", "Unclosed example", "- Not a plain-list fixture"]
  ];

  for (const newline of ["\n", "\r\n"]) {
    for (const sectionBody of sectionBodies) {
      const markdown = [
        "# Scoped Skill",
        "",
        "```text",
        "Outside before examples",
        "```",
        "",
        "## Examples",
        "",
        ...sectionBody
      ].join(newline);
      const pack = buildFixturePack(markdown);

      assert.equal(pack.manifest.caseCount, 0);
      assert.deepEqual(pack.cases, []);
      assert.deepEqual(pack.files, []);
    }
  }
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

test("recognizes setext titles and example sections with LF and CRLF", () => {
  for (const newline of ["\n", "\r\n"]) {
    const markdown = [
      "Demo Skill",
      "==========",
      "",
      "Examples",
      "--------",
      "",
      "- First real example prompt"
    ].join(newline);
    const pack = buildFixturePack(markdown);

    assert.equal(pack.manifest.skillName, "Demo Skill");
    assert.equal(pack.manifest.caseCount, 1);
    assert.deepEqual(pack.cases.map(({ prompt }) => prompt), [
      "First real example prompt"
    ]);
  }
});

test("recognizes ATX headings indented up to three spaces", () => {
  for (const newline of ["\n", "\r\n"]) {
    const markdown = [
      "   # Indented Skill",
      "",
      "   ## Examples",
      "",
      "- Kept prompt"
    ].join(newline);
    const pack = buildFixturePack(markdown);

    assert.equal(pack.manifest.skillName, "Indented Skill");
    assert.deepEqual(pack.cases.map(({ prompt }) => prompt), ["Kept prompt"]);

    const codeIndented = buildFixturePack([
      "    # Code-block title",
      "",
      "    ## Examples",
      "",
      "- Not in an examples section"
    ].join(newline));
    assert.equal(codeIndented.manifest.skillName, "untitled-skill");
    assert.equal(codeIndented.manifest.caseCount, 0);
  }
});

test("does not extract list items after an unclosed fence", () => {
  for (const [fence, newline] of [["```text", "\n"], ["~~~text", "\r\n"]]) {
    const markdown = [
      "# Demo Skill",
      "",
      "## Examples",
      "",
      fence,
      "Fenced sample",
      "- Not a plain-list fixture"
    ].join(newline);
    const pack = buildFixturePack(markdown);

    assert.equal(pack.manifest.caseCount, 0);
  }
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

test("CLI dry-run recognizes setext document headings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "skillfixture-setext-"));
  const source = join(directory, "SKILL.md");
  await writeFile(source, [
    "CLI Setext Skill",
    "=================",
    "",
    "Example",
    "-------",
    "",
    "- Demonstrate the CLI case"
  ].join("\r\n"));

  try {
    const { stdout } = await execFileAsync("node", [
      "bin/skillfixture.js",
      source,
      "--dry-run"
    ]);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.manifest.skillName, "CLI Setext Skill");
    assert.deepEqual(parsed.cases.map(({ prompt }) => prompt), [
      "Demonstrate the CLI case"
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI accepts documented options before or after the source operand", async () => {
  for (const args of [
    ["--dry-run", "test/fixtures/source/SKILL.md"],
    ["test/fixtures/source/SKILL.md", "--dry-run"]
  ]) {
    const { stdout } = await execFileAsync("node", ["bin/skillfixture.js", ...args]);
    assert.equal(JSON.parse(stdout).manifest.caseCount, 2);
  }
});

test("CLI rejects unknown options before treating them as file paths", async () => {
  await assertCliUsageError(["--bogus"], "Unknown option: --bogus");
  await assertCliUsageError(
    ["test/fixtures/source/SKILL.md", "-x"],
    "Unknown option: -x"
  );
});

test("CLI rejects duplicate options", async () => {
  await assertCliUsageError(
    ["test/fixtures/source/SKILL.md", "--dry-run", "--dry-run"],
    "--dry-run may only be specified once"
  );
  await assertCliUsageError(
    ["test/fixtures/source/SKILL.md", "--out", "first", "--out", "second"],
    "--out may only be specified once"
  );
});

test("CLI rejects --out without a directory value", async () => {
  await assertCliUsageError(
    ["test/fixtures/source/SKILL.md", "--out"],
    "--out expects a directory"
  );
  await assertCliUsageError(
    ["test/fixtures/source/SKILL.md", "--out", "--dry-run"],
    "--out expects a directory"
  );
});

test("CLI rejects surplus operands", async () => {
  await assertCliUsageError(
    ["test/fixtures/source/SKILL.md", "another.md", "--dry-run"],
    "Unexpected argument: another.md"
  );
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

test("CLI only uses document-wide fences when examples heading is absent", async () => {
  const scenarios = [
    { section: null, expected: ["Outside example"] },
    { section: [], expected: [] },
    {
      section: ["This section intentionally contains no fixture cases."],
      expected: []
    },
    {
      section: ["```text", "Unclosed example", "- Not a plain-list fixture"],
      expected: []
    }
  ];

  for (const newline of ["\n", "\r\n"]) {
    for (const { section, expected } of scenarios) {
      const dir = await mkdtemp(join(tmpdir(), "skillfixture-scope-"));
      const source = join(dir, "SKILL.md");
      const lines = [
        "# CLI Scoped Skill",
        "",
        "```text",
        "Outside example",
        "```"
      ];
      if (section !== null) {
        lines.push("", "## Examples", "", ...section);
      }

      try {
        await writeFile(source, lines.join(newline));
        const { stdout } = await execFileAsync("node", [
          "bin/skillfixture.js",
          source,
          "--dry-run"
        ]);
        const parsed = JSON.parse(stdout);

        assert.deepEqual(parsed.cases.map(({ prompt }) => prompt), expected);
        assert.equal(parsed.manifest.caseCount, expected.length);
        assert.equal(parsed.files.length, expected.length);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  }
});

test("CLI recognizes indented ATX headings with LF and CRLF input", async () => {
  for (const newline of ["\n", "\r\n"]) {
    const dir = await mkdtemp(join(tmpdir(), "skillfixture-"));
    const source = join(dir, "SKILL.md");
    try {
      await writeFile(source, [
        "   # CLI Skill",
        "",
        "   ## Examples",
        "",
        "- CLI prompt"
      ].join(newline));

      const { stdout } = await execFileAsync("node", [
        "bin/skillfixture.js",
        source,
        "--dry-run"
      ]);
      const parsed = JSON.parse(stdout);

      assert.equal(parsed.manifest.skillName, "CLI Skill");
      assert.deepEqual(parsed.cases.map(({ prompt }) => prompt), ["CLI prompt"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

test("CLI ignores list items after unclosed fences with LF and CRLF input", async () => {
  for (const [fence, newline] of [["```text", "\n"], ["~~~text", "\r\n"]]) {
    const dir = await mkdtemp(join(tmpdir(), "skillfixture-"));
    const source = join(dir, "SKILL.md");
    try {
      await writeFile(source, [
        "# CLI Skill",
        "",
        "## Examples",
        "",
        fence,
        "Fenced sample",
        "- Not a plain-list fixture"
      ].join(newline));

      const { stdout } = await execFileAsync("node", [
        "bin/skillfixture.js",
        source,
        "--dry-run"
      ]);
      const parsed = JSON.parse(stdout);

      assert.equal(parsed.manifest.caseCount, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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
