#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requiredFiles = [
  "bin/skillfixture.js",
  "src/index.js",
  "SKILL.md",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md"
];

const workspace = mkdtempSync(join(tmpdir(), "skillfixture-package-smoke-"));
const consumer = join(workspace, "consumer");
mkdirSync(consumer);

try {
  const output = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", workspace],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  const [pack] = JSON.parse(output);
  const packedFiles = new Set(pack.files.map((file) => file.path));
  const missing = requiredFiles.filter((file) => !packedFiles.has(file));

  if (missing.length > 0) {
    throw new Error(`missing required files: ${missing.join(", ")}`);
  }

  const tarball = join(workspace, pack.filename);
  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    { cwd: consumer, stdio: "pipe" }
  );
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      [
        'import { buildFixturePack } from "skillfixture";',
        'const pack = buildFixturePack("# Installed\\n\\n```text\\nVerify root import\\n```");',
        'if (pack.manifest.caseCount !== 1) throw new Error("fixture pack was not built");'
      ].join("\n")
    ],
    { cwd: consumer, stdio: "pipe" }
  );

  const source = join(workspace, "SKILL.md");
  const outDir = join(workspace, "generated");
  writeFileSync(source, "# Installed\n\n## Examples\n\n- Verify installed CLI output\n");
  const cli = join(consumer, "node_modules", ".bin", "skillfixture");
  execFileSync(process.execPath, [cli, source, "--out", outDir], { stdio: "pipe" });
  const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));
  const cases = JSON.parse(readFileSync(join(outDir, "cases.json"), "utf8"));
  if (manifest.caseCount !== 1 || cases.length !== 1) {
    throw new Error("installed CLI --out did not write the fixture pack");
  }
  if (readFileSync(join(outDir, "case-01.prompt.txt"), "utf8") !== "Verify installed CLI output\n") {
    throw new Error("installed CLI --out wrote unexpected prompt content");
  }

  console.log(
    `package smoke ok: installed ${pack.filename}, imported root API, verified CLI --out, and checked ${pack.files.length} files`
  );
} catch (error) {
  console.error(`package smoke failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
