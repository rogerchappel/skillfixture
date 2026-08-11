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
  const { headings } = scanHeadings(markdown);
  const heading = headings.find(({ level }) => level === 1);
  return heading ? heading.text : "untitled-skill";
}

function extractExamples(markdown) {
  const { lines, headings } = scanHeadings(markdown);
  const start = headings.find(
    ({ level, text }) => level === 2 && /^examples?$/i.test(text)
  );
  if (!start) {
    return [];
  }

  const end = headings.find(
    ({ level, index }) => level === 2 && index > start.index
  );
  const section = lines.slice(start.index + 1, end?.index).join("\n");

  const blocks = extractFencedBlocks(section);
  if (blocks.length > 0) {
    return blocks.map(blockToCase);
  }

  return extractPlainList(section).map((prompt) => ({
    prompt,
    expected: ["manual-review"]
  }));
}

function extractPlainList(markdown) {
  const items = [];
  let current = null;

  for (const line of markdown.split(/\r?\n/)) {
    const item = line.match(/^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]+(\S.*)$/);
    if (item) {
      current = item[1].trim();
      items.push(current);
      continue;
    }

    const continuation = line.match(/^[ \t]+(\S.*)$/);
    if (current !== null && continuation) {
      current = `${current} ${continuation[1].trim()}`;
      items[items.length - 1] = current;
      continue;
    }

    current = null;
  }

  return items;
}

function scanHeadings(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headings = [];
  let closing = null;

  for (let index = 0; index < lines.length; index += 1) {
    if (closing) {
      if (closing.test(lines[index])) {
        closing = null;
      }
      continue;
    }

    const opening = lines[index].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (opening && !(opening[1][0] === "`" && opening[2].includes("`"))) {
      const marker = opening[1][0];
      closing = new RegExp(`^ {0,3}${marker}{${opening[1].length},}[ \\t]*$`);
      continue;
    }

    const heading = lines[index].match(/^(#{1,2})\s+(.+)$/);
    if (heading) {
      const text = heading[2].replace(/[ \t]+#+[ \t]*$/, "").trim();
      headings.push({ index, level: heading[1].length, text });
    }
  }

  return { lines, headings };
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
