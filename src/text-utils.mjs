export function tokenize(text) {
  return (text.normalize("NFKC").toLowerCase().match(/[\p{Letter}\p{Number}]{2,}/gu) ?? []);
}

export function normalizeSupabaseChunk(row) {
  return {
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    headingPath: row.heading_path ?? [],
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: row.similarity,
    vectorScore: row.vector_score,
    keywordScore: row.keyword_score,
    hybridScore: row.hybrid_score
  };
}

export function formatContext(chunks) {
  return chunks
    .map((chunk, index) => {
      const title = chunk.headingPath?.length ? chunk.headingPath.join(" > ") : chunk.id;
      return `[근거 ${index + 1}] chunk_id=${chunk.id}\n제목=${title}\n본문=${chunk.content}`;
    })
    .join("\n\n---\n\n");
}
