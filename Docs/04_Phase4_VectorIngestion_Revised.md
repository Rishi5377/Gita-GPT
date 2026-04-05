# Gita Mirror - Phase 4: Vector Ingestion Pipeline (Revised)

This phase bridges the gap between our structured metadata (`shloka_index`) and deep semantic
search capabilities by processing all 7 source PDFs. We will break the PDFs down into semantic
chunks, generate **384-dimensional embeddings using HuggingFace** (`all-MiniLM-L6-v2`), and
link them directly to the master Shloka IDs in Supabase.

> **Why HuggingFace over OpenAI embeddings:**
> OpenAI `text-embedding-3-small` costs money and produces 1536-dim vectors (~430MB storage),
> dangerously close to Supabase's 500MB free tier limit. HuggingFace `all-MiniLM-L6-v2` is
> free, produces 384-dim vectors (~150MB storage), and performs excellently on
> philosophical/spiritual text similarity.

---

## User Review Required

> [!IMPORTANT]
> The database requires the `pgvector` extension and the `gita_chunks` table to be created
> manually in your Supabase SQL Editor before this script can run. Please let me know once
> you have approved this plan and run the DB setup query below.

---

## Proposed Changes

### Database Setup (To be run by USER in Supabase SQL Editor)

```sql
-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the unified RAG chunks table linked to the master index
CREATE TABLE gita_chunks (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  shloka_id  uuid    REFERENCES shloka_index(id) ON DELETE CASCADE,
  content    text    NOT NULL,                        -- ✅ was: chunk_text
  source_type text   NOT NULL CHECK (source_type IN ( -- ✅ was: free-text filenames
    'g279',
    'general_exp',
    'sloka117',
    'swamy_bg',
    'ttd',
    'bg_as_it_is',
    'essay'
  )),
  chapter    int,
  verse      int,
  embedding  vector(384),                             -- ✅ was: vector(1536) via OpenAI
  metadata   jsonb   DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 3. Create IVFFlat index with cosine similarity         -- ✅ was: HNSW + vector_ip_ops
-- IVFFlat + cosine is correct for HuggingFace embeddings (not normalized for inner product)
-- lists = 100 is a good heuristic for ~60K rows
CREATE INDEX ON gita_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Supporting indexes for fast filtered lookups
CREATE INDEX ON gita_chunks (shloka_id);
CREATE INDEX ON gita_chunks (chapter, verse, source_type);

-- 5. RPC function for similarity search (used by retriever.ts)
CREATE OR REPLACE FUNCTION match_gita_chunks(
  query_embedding vector(384),
  source_types    text[],
  match_count     int DEFAULT 5
)
RETURNS TABLE (
  id          uuid,
  content     text,
  source_type text,
  chapter     int,
  verse       int,
  similarity  float
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    content,
    source_type,
    chapter,
    verse,
    1 - (embedding <=> query_embedding) AS similarity
  FROM gita_chunks
  WHERE source_type = ANY(source_types)
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

### Source Type Key Map

All 7 PDFs map to short, validated `source_type` keys. Use these **exactly** in the ingest
script — they must match the CHECK constraint above and the emotion router in `classifier.ts`.

| PDF Filename | source_type key |
|---|---|
| G279 IND.pdf | `g279` |
| General EXP.pdf | `general_exp` |
| Sloka 117.pdf | `sloka117` |
| Swami-BG.pdf | `swamy_bg` |
| TTD Bhagavat Gita.pdf | `ttd` |
| BG As It Is.pdf | `bg_as_it_is` |
| Essay.pdf | `essay` |

---

### [NEW] `scripts/sourceMap.ts`

```typescript
export const SOURCE_MAP = [
  { file: "G279 IND.pdf",            source_type: "g279" },
  { file: "General EXP.pdf",         source_type: "general_exp" },
  { file: "Sloka 117.pdf",           source_type: "sloka117" },
  { file: "Swami-BG.pdf",            source_type: "swamy_bg" },
  { file: "TTD Bhagavat Gita.pdf",   source_type: "ttd" },
  { file: "BG As It Is.pdf",         source_type: "bg_as_it_is" },
  { file: "Essay.pdf",               source_type: "essay" },
];
```

---

### [NEW] `scripts/embedder.ts`

Replaces OpenAI embedding calls with HuggingFace Inference API (free, no API cost).

```typescript
const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

export async function embedText(text: string): Promise<number[]> {
  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.HF_API_TOKEN && {
        Authorization: `Bearer ${process.env.HF_API_TOKEN}`
      })
    },
    body: JSON.stringify({ inputs: text })
  });

  if (!response.ok) {
    throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  // HF returns number[] for single input
  return Array.isArray(result[0]) ? result[0] : result;
}

// Rate-limit-safe batch embedder
export async function embedBatch(
  texts: string[],
  batchSize = 32,
  delayMs = 200
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(batch.map(embedText));
    embeddings.push(...batchEmbeddings);

    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    console.log(`Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length}`);
  }

  return embeddings;
}
```

---

### [NEW] `scripts/ingest_chunks.ts`

Primary ingestion engine. Processes all 7 PDFs one chapter at a time (memory-safe),
links chunks to `shloka_index` via chapter/verse regex extraction, and pushes to Supabase.

```typescript
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { SOURCE_MAP } from "./sourceMap";
import { embedBatch } from "./embedder";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const ASSETS_DIR = path.join(process.cwd(), "Assets");

// Splitter config: 300 tokens, 50 overlap — balances context vs chunk count
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 300,
  chunkOverlap: 50,
  separators: ["\n\n", "\n", ".", " "]
});

// Cache shloka_index from Supabase: "chapter:verse" → UUID
let shlokaCache: Map<string, string> | null = null;

async function getShlokaCache(): Promise<Map<string, string>> {
  if (shlokaCache) return shlokaCache;

  const { data, error } = await supabase
    .from("shloka_index")
    .select("id, chapter, verse");

  if (error) throw new Error(`Failed to load shloka_index: ${error.message}`);

  shlokaCache = new Map(
    (data ?? []).map(row => [`${row.chapter}:${row.verse}`, row.id])
  );

  console.log(`📚 Loaded ${shlokaCache.size} shlokas from master index`);
  return shlokaCache;
}

// Extract chapter + verse from chunk text using multiple regex patterns
// Adjust patterns if a specific PDF uses a different format
function extractChapterVerse(
  text: string
): { chapter: number; verse: number } | null {
  const patterns = [
    /\bBG\s+(\d+)[.\-:](\d+)\b/i,                          // BG 2.47, BG 2-47
    /\bChapter\s+(\d+)[,\s]+(?:Verse|Shloka|Sloka)\s+(\d+)/i, // Chapter 2, Verse 47
    /\b(\d+)\.(\d+)\b/,                                    // 2.47 (bare)
    /\[(\d+)[.:–](\d+)\]/,                                  // [2.47] or [2:47]
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const chapter = parseInt(match[1]);
      const verse = parseInt(match[2]);
      // Sanity check: Gita has 18 chapters, max ~78 verses
      if (chapter >= 1 && chapter <= 18 && verse >= 1 && verse <= 80) {
        return { chapter, verse };
      }
    }
  }
  return null;
}

async function ingestPDF(
  source: typeof SOURCE_MAP[0],
  cache: Map<string, string>
) {
  const filePath = path.join(ASSETS_DIR, source.file);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Not found: ${source.file} — skipping`);
    return;
  }

  console.log(`\n📖 Processing: ${source.file} → source_type: "${source.source_type}"`);

  // Load PDF
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  // Split into chunks
  const chunks = await splitter.splitDocuments(docs);
  const texts = chunks
    .map(c => c.pageContent.trim())
    .filter(t => t.length > 20);   // drop near-empty chunks

  console.log(`   → ${texts.length} chunks created`);

  // Embed all chunks via HuggingFace (free, 384-dim)
  console.log(`   → Embedding via HuggingFace all-MiniLM-L6-v2...`);
  const embeddings = await embedBatch(texts, 32, 200);

  // Build rows with shloka_id linking
  const rows = texts.map((text, i) => {
    const cv = extractChapterVerse(text);
    const shlokaId = cv
      ? cache.get(`${cv.chapter}:${cv.verse}`) ?? null
      : null;

    return {
      content: text,                          // ✅ correct column name
      source_type: source.source_type,        // ✅ short key, matches CHECK constraint
      chapter: cv?.chapter ?? null,
      verse: cv?.verse ?? null,
      shloka_id: shlokaId,
      embedding: embeddings[i],
      metadata: {
        page: chunks[i].metadata?.page ?? null,
        source_file: source.file,
        linked: shlokaId !== null
      }
    };
  });

  const linked = rows.filter(r => r.shloka_id !== null).length;
  console.log(`   → ${linked}/${rows.length} chunks linked to master index`);

  // Upsert in batches of 100
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from("gita_chunks")
      .insert(rows.slice(i, i + BATCH));

    if (error) {
      console.error(`   ❌ Batch ${i} failed: ${error.message}`);
    } else {
      console.log(`   ✅ Stored ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
    }
  }
}

async function main() {
  console.log("🕉️  Gita Mirror Phase 4 — Vector Ingestion Pipeline\n");

  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`❌ Assets directory not found at: ${ASSETS_DIR}`);
    console.error("Create an 'Assets/' folder at project root and place all 7 PDFs inside.");
    process.exit(1);
  }

  // Verify master index exists before ingesting
  const cache = await getShlokaCache();
  if (cache.size === 0) {
    console.error("❌ shloka_index is empty. Run buildIndex.ts + uploadIndex.ts first.");
    process.exit(1);
  }

  // Process all 7 PDFs sequentially (memory-safe)
  for (const source of SOURCE_MAP) {
    await ingestPDF(source, cache);
  }

  console.log("\n✅ Phase 4 complete. All 7 PDFs ingested.\n");

  // Final stats
  const { count } = await supabase
    .from("gita_chunks")
    .select("*", { count: "exact", head: true });

  console.log(`📊 Total chunks in gita_chunks: ${count}`);
  console.log(`💾 Estimated vector storage: ~${(((count ?? 0) * 384 * 4) / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error);
```

---

### [MODIFY] `package.json`

Install required dependencies:

```bash
npm install langchain @langchain/core @langchain/community pdf-parse @supabase/supabase-js
npm install -D ts-node @types/node
```

Add ingest script shortcut to `package.json`:

```json
{
  "scripts": {
    "ingest": "ts-node --project tsconfig.json scripts/ingest_chunks.ts"
  }
}
```

Run with:

```bash
npm run ingest
```

---

### `.env.local` — Required Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
HF_API_TOKEN=your_huggingface_token    # optional but increases HF rate limits significantly
```

---

## Verification Plan

### Automated Checks (built into ingest script)
- Validates `Assets/` directory exists before starting
- Validates `shloka_index` is populated before ingesting chunks
- Logs link rate per PDF (`linked/total chunks`) — target >60% for structured files
- Logs estimated storage after completion

### Manual Verification (run in Supabase SQL Editor)

**1. Total chunk count:**
```sql
SELECT COUNT(*) FROM gita_chunks;
-- Expected: 50,000 – 70,000
```

**2. Breakdown by source:**
```sql
SELECT source_type, COUNT(*) as chunks
FROM gita_chunks
GROUP BY source_type
ORDER BY chunks DESC;
-- Expected: 7 rows, each 5,000–15,000 chunks
```

**3. Link rate per source (quality check):**
```sql
SELECT
  source_type,
  COUNT(*) as total,
  COUNT(shloka_id) as linked,
  ROUND(COUNT(shloka_id)::numeric / COUNT(*) * 100, 1) as link_pct
FROM gita_chunks
GROUP BY source_type;
-- Target: >70% for G279/Swamy BG, >40% for TTD/BG As It Is (story format = fewer verse markers)
```

**4. Semantic search test (replaces vector_ip_ops test):**
```sql
-- First embed "grief and loss" via your app, then paste the vector here
-- This validates cosine similarity is working correctly
SELECT content, source_type, chapter, verse,
       1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM gita_chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

**5. Verify embedding dimensions:**
```sql
SELECT array_length(embedding::real[], 1) AS dims
FROM gita_chunks
LIMIT 1;
-- Must return: 384 (not 1536)
```

---

## Changes Summary

| # | Original | Revised | Reason |
|---|---|---|---|
| 1 | OpenAI `text-embedding-3-small` (1536-dim, paid) | HuggingFace `all-MiniLM-L6-v2` (384-dim, free) | ₹0 budget, storage safety |
| 2 | `embedding vector(1536)` | `embedding vector(384)` | Matches new embedding model |
| 3 | `HNSW` + `vector_ip_ops` | `IVFFlat` + `vector_cosine_ops` | Cosine is correct for non-normalized HF embeddings |
| 4 | `chunk_text` column | `content` column | Consistency with retriever.ts and RPC functions |
| 5 | `source_type` as filename string | `source_type` as short key with CHECK constraint | Matches classifier.ts emotion router |
| 6 | Verify `vector_ip_ops` | Verify `vector_cosine_ops` + dimension check | Matches updated index type |
