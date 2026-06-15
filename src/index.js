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
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .map((prompt) => ({ prompt, expected: ["manual-review"] }));
}

function extractFencedBlocks(markdown) {
  const blocks = [];
  const pattern = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || "text",
      body: match[2].trim()
    });
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
