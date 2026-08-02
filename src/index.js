import { createHash } from "node:crypto";

export function buildFixturePack(markdown, options = {}) {
  const title = extractTitle(markdown);
  const examples = extractExamples(markdown);
  const blocks = extractFencedBlocks(markdown);
  const cases = examples.length > 0 ? examples : blocks.map(blockToCase);
  const normalizedCases = cases.map((item, index) => normalizeCase(item, index));
  const files = normalizedCases.map((testCase) => ({
    name: `${testCase.id}.prompt.txt`,
    content: `${testCase.prompt}\n`
  }));

  return {
    manifest: {
      schema: "skillfixture/v1",
      sourcePath: options.sourcePath ?? "SKILL.md",
      skillName: title,
      caseCount: normalizedCases.length,
      checksum: checksum(normalizedCases)
    },
    cases: normalizedCases,
    files
  };
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "untitled-skill";
}

function extractExamples(markdown) {
  const section = markdown.match(/##\s+Examples?\s*\n([\s\S]*?)(?=\n##\s+|\s*$)/i);
  if (!section) {
    return [];
  }

  const blocks = extractFencedBlocks(section[1]);
  if (blocks.length > 0) {
    return blocks.map(blockToCase);
  }

  return section[1]
    .split(/\n+/)
    .map((line) => line.replace(/^(?:[-*+]|\d{1,9}[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((prompt) => ({ prompt, expected: ["manual-review"] }));
}

function extractFencedBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!opening || (opening[1][0] === "`" && opening[2].includes("`"))) {
      continue;
    }

    const marker = opening[1][0];
    const minimumLength = opening[1].length;
    const closing = new RegExp(`^ {0,3}${marker}{${minimumLength},}[ \\t]*$`);
    const body = [];
    let closingIndex = index + 1;
    while (closingIndex < lines.length && !closing.test(lines[closingIndex])) {
      body.push(lines[closingIndex]);
      closingIndex += 1;
    }
    if (closingIndex === lines.length) {
      continue;
    }

    const info = opening[2].trim().split(/\s+/, 1)[0];
    blocks.push({
      language: info || "text",
      body: body.join("\n").trim()
    });
    index = closingIndex;
  }

  return blocks;
}

function blockToCase(block) {
  return {
    prompt: block.body,
    expected: [`language:${block.language}`, "manual-review"]
  };
}

function normalizeCase(item, index) {
  const prompt = item.prompt.trim();
  return {
    id: `case-${String(index + 1).padStart(2, "0")}`,
    prompt,
    expected: item.expected,
    hash: checksum(prompt)
  };
}

function checksum(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}
