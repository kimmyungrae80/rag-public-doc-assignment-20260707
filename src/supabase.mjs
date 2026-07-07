import "./env.mjs";

const DOCUMENT_TABLE = "rag_assignment_documents_20260707";
const CHUNK_TABLE = "rag_assignment_chunks_20260707";
const MATCH_FUNCTION = "match_rag_assignment_chunks_20260707";
const HYBRID_FUNCTION = "hybrid_rag_assignment_chunks_20260707";

export function hasSupabaseEnv() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function upsertDocument(document) {
  return upsertRows(DOCUMENT_TABLE, [document]);
}

export async function upsertChunks(chunks) {
  const batchSize = 50;
  for (let i = 0; i < chunks.length; i += batchSize) {
    await upsertRows(CHUNK_TABLE, chunks.slice(i, i + batchSize));
  }
}

export async function matchChunks({ queryEmbedding, matchCount = 6, docFilter = null }) {
  return rpc(MATCH_FUNCTION, {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    doc_filter: docFilter
  });
}

export async function hybridMatchChunks({ queryEmbedding, queryText, matchCount = 12, docFilter = null }) {
  return rpc(HYBRID_FUNCTION, {
    query_embedding: queryEmbedding,
    query_text: queryText,
    match_count: matchCount,
    doc_filter: docFilter
  });
}

async function upsertRows(table, rows) {
  ensureSupabaseEnv();
  const response = await fetch(`${baseUrl()}/rest/v1/${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      ...headers(),
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase upsert failed (${table}): ${response.status} ${text}`);
  }
}

async function rpc(functionName, body) {
  ensureSupabaseEnv();
  const response = await fetch(`${baseUrl()}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(async () => {
    const text = await response.text();
    return { error: text };
  });

  if (!response.ok) {
    throw new Error(`Supabase RPC failed (${functionName}): ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

function ensureSupabaseEnv() {
  if (!hasSupabaseEnv()) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
}

function baseUrl() {
  return process.env.SUPABASE_URL.replace(/\/$/, "");
}

function headers() {
  return {
    "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}
