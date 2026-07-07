import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cosineSimilarity, embedTexts, localHashEmbedding, vectorToPg } from "./embeddings.mjs";
import { chatWithOpenRouter, hasOpenRouterEnv, rewriteQuestionForSearch } from "./openrouter.mjs";
import { rerank } from "./rerank.mjs";
import { hasSupabaseEnv, hybridMatchChunks, matchChunks } from "./supabase.mjs";
import { formatContext, normalizeSupabaseChunk } from "./text-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export async function answerQuestion(question, options = {}) {
  const mode = options.mode ?? "advanced";
  const forceLocal = Boolean(options.local);
  const retrievalQuery = mode === "advanced"
    ? await rewriteQuestionForSearch(question)
    : question;

  const candidates = await retrieveCandidates(retrievalQuery, {
    mode,
    forceLocal,
    matchCount: mode === "advanced" ? 14 : 6
  });

  const contexts = mode === "advanced"
    ? await rerank(question, candidates, 6)
    : candidates.slice(0, 6);

  const answer = hasOpenRouterEnv() && !options.offline
    ? await generateAnswer(question, contexts, mode, retrievalQuery)
    : offlineAnswer(question, contexts, mode, retrievalQuery);

  return {
    question,
    mode,
    retrievalQuery,
    answer,
    contexts
  };
}

async function retrieveCandidates(query, { mode, forceLocal, matchCount }) {
  if (!forceLocal && hasSupabaseEnv()) {
    const [embedding] = await embedTexts([query], { task: "retrieval.query" });
    const queryEmbedding = vectorToPg(embedding);
    const rows = mode === "advanced"
      ? await hybridMatchChunks({ queryEmbedding, queryText: query, matchCount })
      : await matchChunks({ queryEmbedding, matchCount });
    return rows.map(normalizeSupabaseChunk);
  }

  return localRetrieve(query, matchCount);
}

async function localRetrieve(query, matchCount) {
  const chunks = await readLocalChunks();
  const queryEmbedding = localHashEmbedding(query);
  return chunks
    .map((chunk) => {
      const embedding = localHashEmbedding(chunk.content);
      return {
        ...chunk,
        similarity: cosineSimilarity(queryEmbedding, embedding)
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}

async function generateAnswer(question, contexts, mode, retrievalQuery) {
  const contextText = formatContext(contexts);
  return chatWithOpenRouter([
    {
      role: "system",
      content: [
        "너는 한국어 공공기관 문서 기반 RAG 답변 시스템이다.",
        "반드시 제공된 근거 문단 안의 정보만 사용한다.",
        "근거가 부족하면 추측하지 말고 '문서 근거만으로는 확인하기 어렵습니다'라고 답한다.",
        "답변 마지막에 사용한 근거 번호를 짧게 표시한다."
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `RAG 방식: ${mode}`,
        `검색 질의: ${retrievalQuery}`,
        `사용자 질문: ${question}`,
        "",
        "근거 문단:",
        contextText,
        "",
        "위 근거만 사용해 한국어로 간결하게 답변해 주세요."
      ].join("\n")
    }
  ]);
}

function offlineAnswer(question, contexts, mode, retrievalQuery) {
  const lines = [
    `질문: ${question}`,
    `방식: ${mode}`,
    `검색 질의: ${retrievalQuery}`,
    "",
    "OpenRouter API 키가 없어 생성형 답변 대신 검색 근거를 표시합니다.",
    "실제 제출 실행에서는 OPENROUTER_API_KEY를 설정하면 아래 근거를 바탕으로 답변이 생성됩니다.",
    "",
    "상위 근거:"
  ];

  for (const [index, context] of contexts.entries()) {
    const heading = context.headingPath?.join(" > ") || context.id;
    const score = context.rerankScore ?? context.hybridScore ?? context.similarity ?? 0;
    lines.push(`${index + 1}. ${heading} (score=${Number(score).toFixed(4)}, chunk=${context.id})`);
    lines.push(`   ${context.content.replace(/\s+/g, " ").slice(0, 180)}...`);
  }

  return lines.join("\n");
}

async function readLocalChunks() {
  const file = path.join(ROOT, "data", "chunks.json");
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}
