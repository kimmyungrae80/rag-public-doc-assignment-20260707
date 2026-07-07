create extension if not exists vector;
create extension if not exists pg_trgm;

create table if not exists public.rag_assignment_documents_20260707 (
  id text primary key,
  title text not null,
  source_path text not null,
  version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rag_assignment_chunks_20260707 (
  id text primary key,
  document_id text not null references public.rag_assignment_documents_20260707(id) on delete cascade,
  chunk_index integer not null,
  heading_path text[] not null default '{}',
  content text not null,
  content_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(array_to_string(heading_path, ' '), '') || ' ' || content)
  ) stored,
  token_estimate integer not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1024) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists rag_assignment_chunks_20260707_document_idx
  on public.rag_assignment_chunks_20260707(document_id);

create index if not exists rag_assignment_chunks_20260707_heading_idx
  on public.rag_assignment_chunks_20260707 using gin(heading_path);

create index if not exists rag_assignment_chunks_20260707_tsv_idx
  on public.rag_assignment_chunks_20260707 using gin(content_tsv);

create index if not exists rag_assignment_chunks_20260707_embedding_idx
  on public.rag_assignment_chunks_20260707
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.rag_assignment_documents_20260707 disable row level security;
alter table public.rag_assignment_chunks_20260707 disable row level security;

create or replace function public.match_rag_assignment_chunks_20260707(
  query_embedding vector(1024),
  match_count integer default 6,
  doc_filter text default null
)
returns table (
  id text,
  document_id text,
  chunk_index integer,
  heading_path text[],
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.chunk_index,
    c.heading_path,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.rag_assignment_chunks_20260707 c
  where doc_filter is null or c.document_id = doc_filter
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.hybrid_rag_assignment_chunks_20260707(
  query_embedding vector(1024),
  query_text text,
  match_count integer default 12,
  doc_filter text default null
)
returns table (
  id text,
  document_id text,
  chunk_index integer,
  heading_path text[],
  content text,
  metadata jsonb,
  vector_score double precision,
  keyword_score double precision,
  hybrid_score double precision
)
language sql
stable
as $$
  with q as (
    select nullif(trim(query_text), '') as text
  ),
  vector_candidates as (
    select
      c.id,
      c.document_id,
      c.chunk_index,
      c.heading_path,
      c.content,
      c.metadata,
      1 - (c.embedding <=> query_embedding) as vector_score,
      0::double precision as keyword_score
    from public.rag_assignment_chunks_20260707 c
    where doc_filter is null or c.document_id = doc_filter
    order by c.embedding <=> query_embedding
    limit greatest(match_count * 4, 20)
  ),
  keyword_candidates as (
    select
      c.id,
      c.document_id,
      c.chunk_index,
      c.heading_path,
      c.content,
      c.metadata,
      0::double precision as vector_score,
      ts_rank_cd(c.content_tsv, plainto_tsquery('simple', q.text))::double precision as keyword_score
    from public.rag_assignment_chunks_20260707 c
    cross join q
    where q.text is not null
      and (doc_filter is null or c.document_id = doc_filter)
      and c.content_tsv @@ plainto_tsquery('simple', q.text)
    order by keyword_score desc
    limit greatest(match_count * 4, 20)
  ),
  unioned as (
    select * from vector_candidates
    union all
    select * from keyword_candidates
  ),
  scores as (
    select
      u.id,
      max(u.vector_score) as vector_score,
      max(u.keyword_score) as keyword_score
    from unioned u
    group by u.id
  ),
  representatives as (
    select distinct on (u.id)
      u.id,
      u.document_id,
      u.chunk_index,
      u.heading_path,
      u.content,
      u.metadata
    from unioned u
    order by u.id, (u.vector_score + u.keyword_score) desc
  )
  select
    r.id,
    r.document_id,
    r.chunk_index,
    r.heading_path,
    r.content,
    r.metadata,
    s.vector_score,
    s.keyword_score,
    (0.72 * coalesce(s.vector_score, 0)) + (0.28 * least(coalesce(s.keyword_score, 0), 1)) as hybrid_score
  from representatives r
  join scores s on s.id = r.id
  order by hybrid_score desc
  limit match_count;
$$;
