import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chunkMarkdown } from "../src/chunking.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "docs", "agency_emergency_report.md");
const outputPath = path.join(root, "data", "chunks.json");

const markdown = await fs.readFile(sourcePath, "utf8");
const chunks = chunkMarkdown(markdown, {
  documentTitle: "2026년 재난대응 AI 활용 현장교육 운영계획",
  documentId: "agency-emergency-ai-training-2026",
  sourcePath: "docs/agency_emergency_report.md",
  version: "2026-07-07",
  maxChars: 900,
  overlapChars: 160
});

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(chunks, null, 2)}\n`, "utf8");

console.log(`Created ${chunks.length} chunks: ${path.relative(root, outputPath)}`);
for (const chunk of chunks) {
  console.log(`${chunk.id} | ${chunk.tokenEstimate} tokens | ${chunk.headingPath.join(" > ")}`);
}
