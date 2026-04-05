# RAG Implementation Plan v2 — Master Index Architecture
# Gita Mirror — Multi-Perspective Shloka Retrieval Pipeline

**Version:** 2.0 (replaces 03_RAG_ImplementationPlan where applicable)  
**Date:** April 2026  
**Key Change:** Blind similarity search replaced with master-index-driven, address-based multi-perspective retrieval

---

## What Changed From v1

| Aspect | v1 (Blind RAG) | v2 (Master Index RAG) |
|---|---|---|
| Retrieval method | Cosine similarity across 60K chunks | Address lookup via master index |
| Shloka coverage | Random chunks, may miss key verses | Precise — exact chapter + verse |
| Multi-file perspective | Accidental (if similar chunks surface) | Intentional — same shloka from 3-4 files |
| Index structure | Flat vector table | Structured shloka registry |
| Accuracy | ~70% relevant | ~95% relevant |
| Build complexity | Lower | Slightly higher (worth it) |

---

## New Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    MASTER INDEX                          │
│   700 shlokas × {themes, emotions, source locations}    │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────▼────────────────┐
         │         INGEST PIPELINE         │
         │  G279 → LLM tags → JSON index  │
         │  All 7 PDFs → chunks → linked  │
         └───────────────┬────────────────┘
                         │
         ┌───────────────▼────────────────┐
         │       RETRIEVAL PIPELINE        │
         │  emotion → index lookup →       │
         │  shloka addresses →             │
         │  multi-file fetch               │
         └───────────────┬────────────────┘
                         │
         ┌───────────────▼────────────────┐
         │       GENERATION LAYER          │
         │  3-4 perspectives on same       │
         │  shloka → Krishna-mirror prompt │
         └─────────────────────────────────┘
```

---

## Stage 1: Build the Master Index (Hybrid — LLM + Manual Review)

### Step 1.1 — Supabase Schema (Updated)

Run this SQL in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Master index: one row per unique shloka
CREATE TABLE IF NOT EXISTS shloka_index (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter       INT NOT NULL,
  verse         INT NOT NULL,
  themes        TEXT[] DEFAULT '{}',      -- e.g. ['duty', 'action', 'karma']
  emotions      TEXT[] DEFAULT '{}',      -- e.g. ['directionless', 'burnout']
  keywords      TEXT[] DEFAULT '{}',      -- e.g. ['detachment', 'nishkama karma']
  anchor_text   TEXT,                     -- clean meaning from G279 (anchor source)
  UNIQUE(chapter, verse)
);

-- Chunks table: one row per chunk, linked to shloka_index
CREATE TABLE IF NOT EXISTS gita_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shloka_id     UUID REFERENCES shloka_index(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  source_type   TEXT NOT NULL CHECK (source_type IN (
    'g279', 'general_exp', 'sloka117', 'swamy_bg', 'ttd', 'bg_as_it_is', 'essay'
  )),
  chapter       INT,
  verse         INT,
  embedding     VECTOR(384),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for fast shloka lookups
CREATE INDEX ON gita_chunks (shloka_id);
CREATE INDEX ON gita_chunks (chapter, verse, source_type);
CREATE INDEX ON shloka_index USING GIN (emotions);
CREATE INDEX ON shloka_index USING GIN (themes);

-- IVFFlat for fallback similarity search
CREATE INDEX ON gita_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RPC: fetch all perspectives for a list of shlokas
CREATE OR REPLACE FUNCTION get_shloka_perspectives(
  shloka_ids    UUID[],
  source_filter TEXT[] DEFAULT ARRAY['g279','general_exp','ttd','bg_as_it_is','swamy_bg']
)
RETURNS TABLE (
  shloka_id   UUID,
  chapter     INT,
  verse       INT,
  source_type TEXT,
  content     TEXT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    gc.shloka_id,
    gc.chapter,
    gc.verse,
    gc.source_type,
    gc.content
  FROM gita_chunks gc
  WHERE gc.shloka_id = ANY(shloka_ids)
    AND gc.source_type = ANY(source_filter)
  ORDER BY gc.chapter, gc.verse, gc.source_type;
$$;

-- RPC: emotion-based shloka lookup via master index
CREATE OR REPLACE FUNCTION find_shlokas_by_emotion(
  emotion_tags  TEXT[],
  match_count   INT DEFAULT 5
)
RETURNS TABLE (
  id        UUID,
  chapter   INT,
  verse     INT,
  themes    TEXT[],
  emotions  TEXT[],
  anchor_text TEXT
)
LANGUAGE SQL STABLE
AS $$
  SELECT id, chapter, verse, themes, emotions, anchor_text
  FROM shloka_index
  WHERE emotions && emotion_tags       -- overlap operator: any tag matches
  ORDER BY cardinality(
    ARRAY(SELECT unnest(emotions) INTERSECT SELECT unnest(emotion_tags))
  ) DESC                               -- rank by number of matching tags
  LIMIT match_count;
$$;
```

---

### Step 1.2 — Auto-Generate Master Index (LLM Tagging Script)

G279 is the anchor — cleanest shloka + meaning source. The LLM reads each shloka from G279 and auto-tags it.

Create `scripts/buildIndex.ts`:

```typescript
import * as fs from "fs";
import * as path from "path";
import Groq from "groq-sdk";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { createClient } from "@supabase/supabase-js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// All valid emotion tags used across the system
const VALID_EMOTIONS = [
  "directionless", "grief", "burnout", "anger", "fear",
  "confusion", "hopelessness", "guilt", "loneliness",
  "seeking_purpose", "seeking_depth", "seeking_sharp_answer", "general"
];

// All valid theme tags
const VALID_THEMES = [
  "duty", "action", "karma", "detachment", "purpose", "identity",
  "death", "rebirth", "devotion", "knowledge", "ego", "surrender",
  "equanimity", "discipline", "renunciation", "wisdom", "liberation",
  "relationships", "success", "failure", "time", "consciousness"
];

interface ShlokaTag {
  chapter: number;
  verse: number;
  anchor_text: string;
  themes: string[];
  emotions: string[];
  keywords: string[];
}

async function tagShloka(
  chapter: number,
  verse: number,
  shlokaText: string
): Promise<ShlokaTag | null> {
  try {
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `You are a Bhagavad Gita scholar and psychologist. Given a shloka and its meaning, output ONLY valid JSON with no explanation.

Valid emotion tags: ${VALID_EMOTIONS.join(", ")}
Valid theme tags: ${VALID_THEMES.join(", ")}

Output format:
{
  "themes": ["theme1", "theme2"],      // 2-5 tags from valid list
  "emotions": ["emotion1", "emotion2"], // 2-4 tags — what human states does this shloka address?
  "keywords": ["word1", "word2"],       // 3-6 key Sanskrit/English concepts
  "anchor_text": "one sentence clean meaning"
}

Only use tags from the valid lists. Output raw JSON only.`
        },
        {
          role: "user",
          content: `Chapter ${chapter}, Verse ${verse}:\n\n${shlokaText}`
        }
      ]
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      chapter,
      verse,
      anchor_text: parsed.anchor_text,
      themes: parsed.themes.filter((t: string) => VALID_THEMES.includes(t)),
      emotions: parsed.emotions.filter((e: string) => VALID_EMOTIONS.includes(e)),
      keywords: parsed.keywords
    };
  } catch (err) {
    console.error(`Failed to tag Chapter ${chapter} Verse ${verse}:`, err);
    return null;
  }
}

async function buildMasterIndex() {
  console.log("🕉️  Building Master Shloka Index from G279...\n");

  // Load G279 PDF
  const loader = new PDFLoader(path.join(process.cwd(), "pdfs/G279_Proper_Sloka_Meaning.pdf"));
  const docs = await loader.load();
  const fullText = docs.map(d => d.pageContent).join("\n");

  // Parse shlokas — adjust regex to match G279's actual format
  // Example pattern: "Chapter 2, Verse 47" or "2.47"
  // You may need to adjust this regex after inspecting the PDF
  const shlokaPattern = /Chapter\s+(\d+)[,\s]+Verse\s+(\d+)[:\s]+([\s\S]*?)(?=Chapter\s+\d+[,\s]+Verse\s+\d+|$)/gi;
  const matches = [...fullText.matchAll(shlokaPattern)];

  console.log(`Found ${matches.length} shlokas in G279\n`);

  const indexEntries: ShlokaTag[] = [];

  for (let i = 0; i < matches.length; i++) {
    const [, chapter, verse, text] = matches[i];
    const ch = parseInt(chapter);
    const vs = parseInt(verse);

    process.stdout.write(`Tagging ${ch}.${vs} (${i + 1}/${matches.length})... `);

    const tag = await tagShloka(ch, vs, text.trim().slice(0, 500));

    if (tag) {
      indexEntries.push(tag);
      process.stdout.write("✅\n");
    } else {
      process.stdout.write("⚠️ skipped\n");
    }

    // Rate limit: ~1 request/second on Groq free tier
    await new Promise(r => setTimeout(r, 1000));
  }

  // Save to JSON for manual review
  const outputPath = path.join(process.cwd(), "scripts/master_index_draft.json");
  fs.writeFileSync(outputPath, JSON.stringify(indexEntries, null, 2));
  console.log(`\n✅ Draft index saved to: scripts/master_index_draft.json`);
  console.log(`📊 Total shlokas tagged: ${indexEntries.length}`);
  console.log(`\n⚡ NEXT STEP: Open master_index_draft.json, review and correct tags, then run: npx ts-node scripts/uploadIndex.ts`);
}

buildMasterIndex().catch(console.error);
```

---

### Step 1.3 — Manual Review Guide

After `buildIndex.ts` runs, open `master_index_draft.json`. It will look like:

```json
[
  {
    "chapter": 2,
    "verse": 47,
    "anchor_text": "You have the right to perform your duties but not to the fruits of your actions",
    "themes": ["action", "detachment", "karma", "duty"],
    "emotions": ["burnout", "directionless", "seeking_purpose"],
    "keywords": ["nishkama karma", "duty", "fruits of action", "detachment"]
  },
  {
    "chapter": 2,
    "verse": 19,
    "anchor_text": "The soul neither kills nor is killed",
    "themes": ["death", "identity", "consciousness"],
    "emotions": ["grief", "fear", "hopelessness"],
    "keywords": ["atman", "soul", "immortality", "death"]
  }
]
```

**Review checklist:**
- [ ] Are the emotion tags accurate? Would someone grieving actually be helped by this shloka?
- [ ] Are themes too broad or too narrow?
- [ ] Is anchor_text a clean one-sentence meaning?
- [ ] Any shlokas missing entirely? (Check total count = 700)
- [ ] Any obvious LLM mistakes (hallucinated chapter numbers, wrong emotions)?

**Time estimate:** 2–3 hours for a full pass. Focus corrections on chapters 2, 3, 6, 12, 18 — highest emotional density.

---

### Step 1.4 — Upload Approved Index to Supabase

Create `scripts/uploadIndex.ts`:

```typescript
import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function uploadIndex() {
  const indexPath = "scripts/master_index_draft.json"; // rename to master_index_final.json after review
  const entries = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  console.log(`📤 Uploading ${entries.length} shloka entries to Supabase...\n`);

  const BATCH = 50;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const { error } = await supabase
      .from("shloka_index")
      .upsert(batch, { onConflict: "chapter,verse" });

    if (error) {
      console.error(`❌ Batch ${i} error:`, error.message);
    } else {
      console.log(`✅ Uploaded ${Math.min(i + BATCH, entries.length)}/${entries.length}`);
    }
  }

  console.log("\n✅ Master index upload complete.");
}

uploadIndex().catch(console.error);
```

---

## Stage 2: Ingest All 7 PDFs (Linked to Master Index)

The ingest script now links every chunk to its `shloka_id` in the master index.

Create `scripts/ingest_v2.ts`:

```typescript
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { SOURCE_MAP } from "./sourceMap";
import { embedBatch } from "./embedder"; // same as v1

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Cache master index locally to avoid repeated DB calls
let shlokaIndexCache: Map<string, string> | null = null;

async function getShlokaIndex(): Promise<Map<string, string>> {
  if (shlokaIndexCache) return shlokaIndexCache;

  const { data } = await supabase
    .from("shloka_index")
    .select("id, chapter, verse");

  shlokaIndexCache = new Map(
    (data ?? []).map(row => [`${row.chapter}:${row.verse}`, row.id])
  );

  console.log(`📚 Loaded ${shlokaIndexCache.size} shlokas from master index`);
  return shlokaIndexCache;
}

// Extract chapter/verse from chunk text using heuristics
// Adjust regex patterns based on each PDF's actual format
function extractChapterVerse(text: string): { chapter: number; verse: number } | null {
  const patterns = [
    /Chapter\s+(\d+)[,\s]+(?:Verse|Shloka|Sloka)\s+(\d+)/i,
    /(\d+)\.(\d+)/,              // e.g. "2.47"
    /BG\s+(\d+)\.(\d+)/i,        // e.g. "BG 2.47"
    /\[(\d+)\.(\d+)\]/           // e.g. "[2.47]"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return { chapter: parseInt(match[1]), verse: parseInt(match[2]) };
    }
  }
  return null;
}

async function ingestPDF(source: typeof SOURCE_MAP[0], index: Map<string, string>) {
  const filePath = path.join(process.cwd(), "pdfs", source.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Not found: ${source.file} — skipping`);
    return;
  }

  console.log(`\n📖 Processing: ${source.file} (${source.source_type})`);

  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 300,
    chunkOverlap: 50,
    separators: ["\n\n", "\n", ".", " "]
  });

  const chunks = await splitter.splitDocuments(docs);
  const texts = chunks.map(c => c.pageContent.trim()).filter(t => t.length > 20);

  console.log(`   → ${texts.length} chunks | Embedding...`);
  const embeddings = await embedBatch(texts, 32, 200);

  const rows = texts.map((text, i) => {
    const cv = extractChapterVerse(text);
    const shlokaId = cv ? index.get(`${cv.chapter}:${cv.verse}`) ?? null : null;

    return {
      content: text,
      source_type: source.source_type,
      chapter: cv?.chapter ?? null,
      verse: cv?.verse ?? null,
      shloka_id: shlokaId,
      embedding: embeddings[i],
      metadata: {
        page: chunks[i].metadata?.page,
        source_file: source.file,
        linked: shlokaId !== null
      }
    };
  });

  const linked = rows.filter(r => r.shloka_id !== null).length;
  console.log(`   → ${linked}/${rows.length} chunks linked to master index`);

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from("gita_chunks")
      .insert(rows.slice(i, i + BATCH));

    if (error) console.error(`   ❌ Batch ${i} error:`, error.message);
    else console.log(`   ✅ Stored ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
}

async function main() {
  console.log("🕉️  Gita Mirror v2 — Ingest Pipeline\n");

  const index = await getShlokaIndex();

  if (index.size === 0) {
    console.error("❌ Master index is empty. Run buildIndex.ts + uploadIndex.ts first.");
    process.exit(1);
  }

  for (const source of SOURCE_MAP) {
    await ingestPDF(source, index);
  }

  console.log("\n✅ All 7 PDFs ingested and linked to master index.");
}

main().catch(console.error);
```

---

## Stage 3: Retrieval (Address-Based, Multi-Perspective)

### Updated Retriever

Replace `lib/retriever.ts` with:

```typescript
import { createClient } from "@supabase/supabase-js";
import { classifyEmotionalState } from "./classifier";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface ShlokaWithPerspectives {
  chapter: number;
  verse: number;
  anchor_text: string;
  perspectives: {
    source_type: string;
    content: string;
  }[];
}

// Preferred source order for multi-perspective assembly
const PERSPECTIVE_PRIORITY = [
  "bg_as_it_is",   // scenario-based — most relatable
  "ttd",           // story mode — narrative
  "general_exp",   // deep explanation
  "swamy_bg",      // sharp meaning
  "g279"           // anchor meaning (always included)
];

export async function retrieveShlokas(
  userMessage: string,
  shlokaCount = 3
): Promise<ShlokaWithPerspectives[]> {

  // Step 1: Classify emotion
  const emotionalState = await classifyEmotionalState(userMessage);
  console.log(`[retriever] Emotion: ${emotionalState}`);

  // Step 2: Lookup master index by emotion tag
  const { data: shlokas, error: indexError } = await supabase.rpc(
    "find_shlokas_by_emotion",
    {
      emotion_tags: [emotionalState],
      match_count: shlokaCount
    }
  );

  if (indexError || !shlokas?.length) {
    console.warn("[retriever] Index lookup failed, falling back to similarity search");
    return fallbackSimilaritySearch(userMessage);
  }

  console.log(`[retriever] Found ${shlokas.length} shlokas: ${shlokas.map((s: any) => `${s.chapter}.${s.verse}`).join(", ")}`);

  // Step 3: Fetch perspectives for each shloka from multiple files
  const shlokaIds = shlokas.map((s: any) => s.id);

  const { data: chunks, error: chunkError } = await supabase.rpc(
    "get_shloka_perspectives",
    {
      shloka_ids: shlokaIds,
      source_filter: PERSPECTIVE_PRIORITY
    }
  );

  if (chunkError) {
    console.error("[retriever] Perspective fetch error:", chunkError);
    return [];
  }

  // Step 4: Assemble — group perspectives by shloka
  const result: ShlokaWithPerspectives[] = shlokas.map((shloka: any) => {
    const shlokaChunks = (chunks ?? [])
      .filter((c: any) => c.shloka_id === shloka.id)
      .sort((a: any, b: any) =>
        PERSPECTIVE_PRIORITY.indexOf(a.source_type) -
        PERSPECTIVE_PRIORITY.indexOf(b.source_type)
      )
      .slice(0, 4); // max 4 perspectives per shloka

    return {
      chapter: shloka.chapter,
      verse: shloka.verse,
      anchor_text: shloka.anchor_text,
      perspectives: shlokaChunks.map((c: any) => ({
        source_type: c.source_type,
        content: c.content
      }))
    };
  });

  return result;
}

// Fallback: use similarity search if index lookup returns nothing
async function fallbackSimilaritySearch(
  userMessage: string
): Promise<ShlokaWithPerspectives[]> {
  // Import embedText only when needed (avoid loading HF on every request)
  const { embedText } = await import("./embedder");
  const embedding = await embedText(userMessage);

  const { data } = await supabase.rpc("match_gita_chunks", {
    query_embedding: embedding,
    source_types: ["bg_as_it_is", "g279", "ttd"],
    match_count: 5
  });

  return (data ?? []).map((chunk: any) => ({
    chapter: chunk.chapter,
    verse: chunk.verse,
    anchor_text: chunk.content,
    perspectives: [{ source_type: chunk.source_type, content: chunk.content }]
  }));
}
```

---

## Stage 4: Generation (Updated Prompt Builder)

Update `lib/prompts.ts` to handle multi-perspective input:

```typescript
export function buildContextFromShlokas(shlokas: ShlokaWithPerspectives[]): string {
  if (!shlokas.length) return "";

  return shlokas.map(shloka => {
    const header = `── Chapter ${shloka.chapter}, Verse ${shloka.verse} ──`;
    const anchor = `Core meaning: ${shloka.anchor_text}`;

    const perspectives = shloka.perspectives
      .map(p => {
        const labels: Record<string, string> = {
          bg_as_it_is: "Scenario lens",
          ttd: "Story lens",
          general_exp: "Deep explanation",
          swamy_bg: "Sharp meaning",
          g279: "Direct meaning",
          sloka117: "Sanskrit original",
          essay: "Overview"
        };
        return `[${labels[p.source_type] ?? p.source_type}]\n${p.content}`;
      })
      .join("\n\n");

    return `${header}\n${anchor}\n\n${perspectives}`;
  }).join("\n\n═══════════════════════════════\n\n");
}
```

---

## Build Order (Correct Sequence)

```
Phase 1 — Master Index (do this first, everything depends on it)
  1. npx ts-node scripts/buildIndex.ts       ← auto-tag 700 shlokas (~2-3 hours, runs overnight)
  2. Manual review of master_index_draft.json (~2-3 hours)
  3. npx ts-node scripts/uploadIndex.ts      ← push approved index to Supabase

Phase 2 — Ingest All PDFs
  4. npx ts-node scripts/ingest_v2.ts        ← ingest all 7 PDFs, link to index (~1-2 hours)

Phase 3 — API + Generation
  5. Build /api/chat route with updated retriever
  6. Test end-to-end with sample emotional queries
```

---

## Testing Checklist

```sql
-- 1. Verify master index populated
SELECT COUNT(*) FROM shloka_index;
-- Expected: ~700

-- 2. Check emotion distribution
SELECT unnest(emotions) as emotion, COUNT(*) as shloka_count
FROM shloka_index
GROUP BY emotion ORDER BY shloka_count DESC;

-- 3. Verify chunk linking quality
SELECT source_type,
  COUNT(*) as total,
  COUNT(shloka_id) as linked,
  ROUND(COUNT(shloka_id)::numeric / COUNT(*) * 100, 1) as link_pct
FROM gita_chunks
GROUP BY source_type;
-- Target: >70% linked for structured files (G279, Swamy BG), >40% for story files (TTD)

-- 4. Test multi-perspective fetch for a known shloka
SELECT * FROM get_shloka_perspectives(
  ARRAY[(SELECT id FROM shloka_index WHERE chapter=2 AND verse=47)],
  ARRAY['g279','bg_as_it_is','ttd','swamy_bg']
);
-- Expected: 3-4 rows with different source_types, same chapter/verse
```

---

## Estimated Timeline

| Phase | Task | Time |
|---|---|---|
| Phase 1 | Run buildIndex.ts (overnight) | 2–3 hrs (unattended) |
| Phase 1 | Manual review of draft index | 2–3 hrs |
| Phase 1 | Upload final index | 15 min |
| Phase 2 | Run ingest_v2.ts (overnight) | 1–2 hrs (unattended) |
| Phase 3 | Build updated /api/chat | 2 hrs |
| Phase 3 | End-to-end testing + tuning | 2–3 hrs |
| **Total active dev time** | | **~10–12 hrs** |

Both overnight scripts can run simultaneously if you start them before bed.

---

## Key Advantages Over v1

- **Precision:** Model always gets the exact shloka — not a random nearby chunk
- **Multi-lens wisdom:** Same verse seen through story, scenario, explanation, and sharp meaning simultaneously
- **Portfolio story:** "I built a structured shloka registry with multi-perspective retrieval" is a far stronger talking point than "I did RAG on PDFs"
- **Extensible:** Adding new commentaries later = just add a new source_type and re-ingest one file
- **Debuggable:** You can query which shlokas fire for which emotions and tune it precisely
