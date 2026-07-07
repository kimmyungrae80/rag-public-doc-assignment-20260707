import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { embedTexts, vectorToPg } from "../src/embeddings.mjs";
import { upsertChunks, upsertDocument } from "../src/supabase.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const chunksPath = path.join(root, "data", "chunks.json");
const chunks = JSON.parse(await fs.readFile(chunksPath, "utf8"));
const documentId = chunks[0]?.documentId;

if (!documentId) {
  throw new Error("No chunks found. Run npm run chunk first.");
}

await upsertDocument({
  id: documentId,
  title: "2026년 재난대응 AI 활용 현장교육 운영계획",
  source_path: "docs/agency_emergency_report.md",
  version: "2026-07-07",
  metadata: {
    assignment: "RAG 기반 문서 검색·답변 시스템 구현 과제",
    pageLimit: "10장 이내",
    language: "ko"
  }
});

const embeddings = await embedTexts(chunks.map((chunk) => chunk.content), { task: "retrieval.passage" });
const rows = chunks.map((chunk, index) => ({
  id: chunk.id,
  document_id: chunk.documentId,
  chunk_index: chunk.chunkIndex,
  heading_path: chunk.headingPath,
  content: chunk.content,
  token_estimate: chunk.tokenEstimate,
  metadata: chunk.metadata,
  embedding: vectorToPg(embeddings[index])
}));

await upsertChunks(rows);
console.log(`Upserted ${rows.length} chunks into Supabase.`);
