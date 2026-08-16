#!/usr/bin/env node
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildFixturePack } from "../src/index.js";

async function version() {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );
  return packageJson.version;
}

function usage() {
  return [
    "Usage: skillfixture <SKILL.md> [--out fixtures/skill] [--dry-run]",
    "",
    "Extracts examples and fenced blocks from a skill into deterministic fixtures."
  ].join("\n");
}

async function removeObsoletePromptFiles(outDir, nextFiles) {
  let previousCases;
  try {
    previousCases = JSON.parse(await readFile(join(outDir, "cases.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  if (!Array.isArray(previousCases)) {
    throw new Error(`Existing ${join(outDir, "cases.json")} must contain an array`);
  }

  const nextNames = new Set(nextFiles.map((file) => file.name));
  const obsoleteNames = previousCases
    .map((testCase) => `${testCase.id}.prompt.txt`)
    .filter((name) => /^case-\d+\.prompt\.txt$/.test(name) && !nextNames.has(name));

  await Promise.all(obsoleteNames.map(async (name) => {
    try {
      await unlink(join(outDir, name));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }));
}

async function main(argv) {
  let sourcePath;
  let outDir = "fixtures/skill";
  let dryRun = false;
  let outSeen = false;
  let dryRunSeen = false;
  let action;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      if (outSeen) {
        throw new Error("--out may only be specified once");
      }
      outSeen = true;
      outDir = argv[index + 1];
      index += 1;
      if (!outDir || outDir.startsWith("-")) {
        throw new Error("--out expects a directory");
      }
    } else if (arg === "--dry-run") {
      if (dryRunSeen) {
        throw new Error("--dry-run may only be specified once");
      }
      dryRunSeen = true;
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      if (action) {
        throw new Error(`Unexpected argument: ${arg}`);
      }
      action = "help";
    } else if (arg === "--version" || arg === "-v") {
      if (action) {
        throw new Error(`Unexpected argument: ${arg}`);
      }
      action = "version";
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!sourcePath) {
      sourcePath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (action) {
    if (sourcePath || outSeen || dryRunSeen) {
      throw new Error(`Unexpected argument with --${action}`);
    }
    console.log(action === "help" ? usage() : await version());
    return 0;
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
  await removeObsoletePromptFiles(outDir, pack.files);
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
