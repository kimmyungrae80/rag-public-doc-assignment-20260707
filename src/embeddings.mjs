import "./env.mjs";
import crypto from "node:crypto";

const DEFAULT_DIMENSIONS = Number.parseInt(process.env.EMBEDDING_DIMENSIONS ?? "1024", 10);

export async function embedTexts(texts, options = {}) {
  const task = options.task ?? "retrieval.passage";
  if (process.env.JINA_API_KEY) {
    return embedWithJina(texts, task);
  }
  return texts.map((text) => localHashEmbedding(text, DEFAULT_DIMENSIONS));
}

async function embedWithJina(texts, task) {
  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.JINA_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.EMBEDDING_MODEL ?? "jina-embeddings-v3",
      task,
      input: texts
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Jina embedding failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload.data.map((item) => item.embedding);
}

export function localHashEmbedding(text, dimensions = DEFAULT_DIMENSIONS) {
  const vector = new Array(dimensions).fill(0);
  const terms = tokenizeForHashing(text);

  for (const term of terms) {
    const hash = crypto.createHash("sha256").update(term).digest();
    const index = hash.readUInt32BE(0) % dimensions;
    const sign = (hash[4] & 1) === 0 ? 1 : -1;
    const weight = Math.min(3, Math.sqrt(Math.max(1, [...term].length)));
    vector[index] += sign * weight;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(8)));
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  return dot / ((Math.sqrt(aNorm) || 1) * (Math.sqrt(bNorm) || 1));
}

export function vectorToPg(value) {
  return `[${value.map((number) => Number(number).toFixed(8)).join(",")}]`;
}

function tokenizeForHashing(text) {
  const normalized = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.match(/[\p{Letter}\p{Number}]+/gu) ?? [];
  const terms = [];

  for (const word of words) {
    terms.push(word);
    const chars = [...word];
    for (let size = 2; size <= 3; size += 1) {
      for (let i = 0; i <= chars.length - size; i += 1) {
        terms.push(chars.slice(i, i + size).join(""));
      }
    }
  }

  return terms.length ? terms : [normalized || "empty"];
}
