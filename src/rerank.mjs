import "./env.mjs";
import { tokenize } from "./text-utils.mjs";

export async function rerank(question, candidates, topN = 6) {
  const provider = (process.env.RERANK_PROVIDER ?? "").toLowerCase();

  if ((provider === "cohere" || (!provider && process.env.COHERE_API_KEY)) && process.env.COHERE_API_KEY) {
    return rerankWithCohere(question, candidates, topN);
  }

  if ((provider === "jina" || (!provider && process.env.JINA_API_KEY)) && process.env.JINA_API_KEY) {
    return rerankWithJina(question, candidates, topN);
  }

  return localRerank(question, candidates, topN);
}

async function rerankWithCohere(question, candidates, topN) {
  const response = await fetch("https://api.cohere.com/v2/rerank", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.COHERE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.RERANK_MODEL ?? "rerank-multilingual-v3.0",
      query: question,
      documents: candidates.map((candidate) => candidate.content),
      top_n: topN
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Cohere rerank failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload.results.map((result) => ({
    ...candidates[result.index],
    rerankScore: result.relevance_score,
    rerankProvider: "cohere"
  }));
}

async function rerankWithJina(question, candidates, topN) {
  const response = await fetch("https://api.jina.ai/v1/rerank", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.RERANK_MODEL ?? "jina-reranker-v2-base-multilingual",
      query: question,
      documents: candidates.map((candidate) => candidate.content),
      top_n: topN
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Jina rerank failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload.results.map((result) => ({
    ...candidates[result.index],
    rerankScore: result.relevance_score,
    rerankProvider: "jina"
  }));
}

function localRerank(question, candidates, topN) {
  const questionTerms = new Set(tokenize(question));
  return candidates
    .map((candidate) => {
      const contentTerms = new Set(tokenize(candidate.content));
      let overlap = 0;
      for (const term of questionTerms) {
        if (contentTerms.has(term)) overlap += 1;
      }
      const lexicalScore = overlap / Math.max(1, questionTerms.size);
      const retrievalScore = candidate.similarity ?? candidate.hybridScore ?? candidate.vectorScore ?? 0;
      return {
        ...candidate,
        rerankScore: Number((lexicalScore * 0.65 + retrievalScore * 0.35).toFixed(6)),
        rerankProvider: "local"
      };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, topN);
}
