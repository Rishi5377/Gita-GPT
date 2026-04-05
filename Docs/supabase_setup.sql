-- Run this in your Supabase SQL Editor to enable vector search for Gita Chunks

CREATE OR REPLACE FUNCTION match_gita_chunks (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  source_type text,
  chapter int,
  verse int,
  shloka_id uuid,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gc.id,
    gc.content,
    gc.source_type,
    gc.chapter,
    gc.verse,
    gc.shloka_id,
    gc.metadata,
    1 - (gc.embedding <=> query_embedding) AS similarity
  FROM gita_chunks gc
  WHERE 1 - (gc.embedding <=> query_embedding) > match_threshold
  ORDER BY gc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create an index to speed up vector search
CREATE INDEX IF NOT EXISTS gita_chunks_embedding_idx ON gita_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
