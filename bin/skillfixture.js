#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildFixturePack } from "../src/index.js";

function usage() {
  return [
    "Usage: skillfixture <SKILL.md> [--out fixtures/skill] [--dry-run]",
    "",
    "Extracts examples and fenced blocks from a skill into deterministic fixtures."
  ].join("\n");
}

async function main(argv) {
  let sourcePath;
  let outDir = "fixtures/skill";
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      outDir = argv[index + 1];
      index += 1;
      if (!outDir) {
        throw new Error("--out expects a directory");
      }
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      return 0;
    } else if (!sourcePath) {
      sourcePath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!sourcePath) {
    console.error(usage());
    return 2;
  }

  const markdown = await readFile(sourcePath, "utf8");
  const pack = buildFixturePack(markdown, { sourcePath });

  if (dryRun) {
    console.log(JSON.stringify(pack, null, 2));
    return 0;
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(pack.manifest, null, 2)}\n`);
  await writeFile(join(outDir, "cases.json"), `${JSON.stringify(pack.cases, null, 2)}\n`);

  for (const file of pack.files) {
    await writeFile(join(outDir, file.name), file.content);
  }

  console.log(`wrote ${pack.cases.length} cases to ${outDir}`);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`skillfixture: ${error.message}`);
    process.exitCode = 2;
  });
