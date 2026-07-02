#!/usr/bin/env node

import { execFileSync } from "node:child_process";

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

const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

const [pack] = JSON.parse(output);
const packedFiles = new Set(pack.files.map((file) => file.path));
const missing = requiredFiles.filter((file) => !packedFiles.has(file));

if (missing.length > 0) {
  console.error(`package smoke failed: missing ${missing.join(", ")}`);
  process.exit(1);
}

console.log(
  `package smoke ok: ${pack.filename} includes ${pack.files.length} files`
);
