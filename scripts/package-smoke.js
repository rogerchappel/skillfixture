#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
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

  console.log(
    `package smoke ok: installed ${pack.filename}, imported root API, and verified ${pack.files.length} files`
  );
} catch (error) {
  console.error(`package smoke failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
