export function estimateTokens(text) {
  return Math.ceil([...text].length / 2.7);
}

export function chunkMarkdown(markdown, options = {}) {
  const maxChars = options.maxChars ?? 900;
  const overlapChars = options.overlapChars ?? 160;
  const documentTitle = options.documentTitle ?? "document";
  const documentId = options.documentId ?? slugify(documentTitle);
  const sourcePath = options.sourcePath ?? "";
  const version = options.version ?? "2026-07-07";

  const blocks = markdownToBlocks(markdown);
  const chunks = [];

  for (const block of blocks) {
    const pieces = splitBySemanticSize(block.text, maxChars, overlapChars);
    for (const piece of pieces) {
      const headingLabel = block.headingPath.length ? `[${block.headingPath.join(" > ")}]\n` : "";
      const content = `${headingLabel}${piece}`.trim();
      chunks.push({
        id: `${documentId}-${String(chunks.length + 1).padStart(3, "0")}`,
        documentId,
        chunkIndex: chunks.length,
        headingPath: block.headingPath,
        content,
        tokenEstimate: estimateTokens(content),
        metadata: {
          documentTitle,
          sourcePath,
          version,
          chunking: "heading-aware semantic paragraph chunking with overlap",
          maxChars,
          overlapChars
        }
      });
    }
  }

  return chunks;
}

function markdownToBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  const headings = [];
  let buffer = [];

  const flush = () => {
    const text = buffer.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text) {
      blocks.push({
        headingPath: headings.filter(Boolean),
        text
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      const level = match[1].length;
      headings.length = level - 1;
      headings[level - 1] = match[2].trim();
      continue;
    }
    buffer.push(line);
  }

  flush();
  return blocks;
}

function splitBySemanticSize(text, maxChars, overlapChars) {
  const normalized = text.trim();
  if ([...normalized].length <= maxChars) {
    return [normalized];
  }

  const sentences = normalized
    .split(/(?<=[.!?。？！다요함임음됨\)])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return splitHard(normalized, maxChars, overlapChars);
  }

  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if ([...candidate].length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) {
      chunks.push(current);
    }
    current = withOverlap(current, sentence, overlapChars);
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.flatMap((chunk) =>
    [...chunk].length > maxChars ? splitHard(chunk, maxChars, overlapChars) : [chunk]
  );
}

function splitHard(text, maxChars, overlapChars) {
  const chars = [...text];
  const chunks = [];
  let start = 0;
  while (start < chars.length) {
    const end = Math.min(start + maxChars, chars.length);
    chunks.push(chars.slice(start, end).join("").trim());
    if (end === chars.length) break;
    start = Math.max(0, end - overlapChars);
  }
  return chunks.filter(Boolean);
}

function withOverlap(previous, next, overlapChars) {
  if (!previous) return next;
  const overlap = [...previous].slice(-overlapChars).join("").trim();
  return `${overlap}\n${next}`.trim();
}

export function slugify(input) {
  return input
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
}
