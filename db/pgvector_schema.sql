-- Career Intel production schema sketch for Postgres + pgvector.
-- Intended for managed Postgres on AWS RDS/Aurora, Cloud SQL, Azure Database
-- for PostgreSQL, Supabase, Neon, or any Postgres host with pgvector enabled.

create extension if not exists vector;
create extension if not exists pgcrypto;

create type document_kind as enum ('resume', 'job');
create type chat_role as enum ('user', 'assistant');

create table app_user (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

create table document (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  kind document_kind not null,
  filename text not null,
  title text,
  company text,
  mime_type text not null,
  storage_uri text,
  raw_text text not null,
  uploaded_at timestamptz not null default now()
);

create table document_chunk (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references document(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  document_kind document_kind not null,
  source_label text not null,
  chunk_index integer not null,
  text text not null,
  embedding_model text not null,
  -- gemini-embedding-001 returns 3072-dimensional embeddings.
  -- If the embedding model changes, create a new column/table or re-embed.
  embedding vector(3072) not null,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index, embedding_model)
);

create table chat_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chat_message (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_session(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  role chat_role not null,
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table retrieval_event (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_session(id) on delete set null,
  user_id uuid not null references app_user(id) on delete cascade,
  query text not null,
  query_embedding_model text not null,
  retrieved_chunk_ids uuid[] not null,
  scores real[] not null,
  created_at timestamptz not null default now()
);

create index document_user_kind_idx on document(user_id, kind);
create index document_chunk_user_kind_idx on document_chunk(user_id, document_kind);
create index document_chunk_document_idx on document_chunk(document_id, chunk_index);

-- HNSW is a strong default for incremental RAG workloads.
-- Use cosine distance because Gemini embeddings are used for semantic similarity.
create index document_chunk_embedding_hnsw_idx
  on document_chunk
  using hnsw (embedding vector_cosine_ops);

-- Example retrieval query:
-- select id, document_id, source_label, text, 1 - (embedding <=> $1::vector) as score
-- from document_chunk
-- where user_id = $2
--   and document_id = any($3::uuid[])
-- order by embedding <=> $1::vector
-- limit $4;
