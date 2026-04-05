# RAG Implementation Plan
# Gita Mirror — Retrieval Augmented Generation Pipeline

**Version:** 1.0  
**Date:** April 2026  
**Scope:** Ingest pipeline + retrieval system + LLM generation layer  
**Excludes:** Frontend UI (see Frontend Implementation Plan)

---

## Overview

The RAG pipeline has three distinct stages:

```
STAGE 1: INGEST (one-time setup)
7 PDFs → Parse → Chunk → Tag → Embed → Store in Supabase

STAGE 2: RETRIEVAL (every conversation turn)
User message → Classify emotion → Route sources → Embed query → Similarity search

STAGE 3: GENERATION (every conversation turn)
Retrieved chunks + Persona prompt + History → Groq → Streamed response
```

---

## Stage 1: Ingest Pipeline

### Step 1.1 — Environment Setup

```bash
# Create Next.js project (if not already done)
npx create-next-app@latest gita-mirror --typescript --tailwind --app

cd gita-mirror

# Install RAG dependencies
npm install langchain @langchain/community pdf-parse @supabase/supabase-js groq-sdk

# Install ingest-only dev dependencies
npm install -D ts-node @types/node
```

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_key
HF_API_TOKEN=your_hf_token  # optional but recommended
```

---

### Step 1.2 — Supabase Schema Setup

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main chunks table
CREATE TABLE IF NOT EXISTS gita_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'g279', 'general_exp', 'sloka117', 'swamy_bg', 'ttd', 'bg_as_it_is', 'essay'
  )),
  chapter     INT,
  verse       INT,
  embedding   VECTOR(384),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- IVFFlat index for approximate nearest neighbor search
-- lists = sqrt(num_rows) is a good heuristic; 100 works for ~60K rows
CREATE INDEX ON gita_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RPC function for similarity search with source filtering
CREATE OR REPLACE FUNCTION match_gita_chunks(
  query_embedding VECTOR(384),
  source_types    TEXT[],
  match_count     INT DEFAULT 5
)
RETURNS TABLE (
  id          UUID,
  content     TEXT,
  source_type TEXT,
  chapter     INT,
  verse       INT,
  similarity  FLOAT
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

### Step 1.3 — PDF Source Map

Create `scripts/sourceMap.ts`:

```typescript
export const SOURCE_MAP = [
  {
    file: "G279_Proper_Sloka_Meaning.pdf",
    source_type: "g279",
    description: "Proper Shloka and Meaning"
  },
  {
    file: "General_EXP_Elaborative.pdf",
    source_type: "general_exp",
    description: "Elaborative Explanation of Verses"
  },
  {
    file: "Sloka_117_Sanskrit_Transliterations.pdf",
    source_type: "sloka117",
    description: "All Sanskrit Verses and Transliterations"
  },
  {
    file: "Swamy_BG_OnPoint.pdf",
    source_type: "swamy_bg",
    description: "Straight On-Point Meanings"
  },
  {
    file: "TTD_Bhagavat_Gita_StoryMode.pdf",
    source_type: "ttd",
    description: "Story Mode Version"
  },
  {
    file: "BG_As_It_Is_Scenario.pdf",
    source_type: "bg_as_it_is",
    description: "Situational Scenario-based Teaching"
  },
  {
    file: "Essay_Briefing.pdf",
    source_type: "essay",
    description: "Briefing of All PDFs"
  }
];
```

---

### Step 1.4 — Embedding Helper

Create `scripts/embedder.ts`:

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
    throw new Error(`HuggingFace API error: ${response.statusText}`);
  }

  const result = await response.json();
  // HF returns [[...embedding]] for batch, [...embedding] for single
  return Array.isArray(result[0]) ? result[0] : result;
}

// Batch embed with rate limit safety
export async function embedBatch(
  texts: string[],
  batchSize = 32,
  delayMs = 100
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(batch.map(embedText));
    embeddings.push(...batchEmbeddings);

    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    console.log(`Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks`);
  }

  return embeddings;
}
```

---

### Step 1.5 — Main Ingest Script

Create `scripts/ingest.ts`:

```typescript
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { SOURCE_MAP } from "./sourceMap";
import { embedBatch } from "./embedder";

// Initialize Supabase with service key (elevated permissions for bulk insert)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const PDF_DIR = path.join(process.cwd(), "pdfs");

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 300,
  chunkOverlap: 50,
  separators: ["\n\n", "\n", ".", " "]
});

async function ingestPDF(source: typeof SOURCE_MAP[0]) {
  const filePath = path.join(PDF_DIR, source.file);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${source.file} — skipping`);
    return;
  }

  console.log(`\n📖 Processing: ${source.file}`);

  // Load PDF
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  // Chunk the text
  const chunks = await splitter.splitDocuments(docs);
  console.log(`   → ${chunks.length} chunks created`);

  // Extract text and basic metadata
  const texts = chunks.map(c => c.pageContent.trim()).filter(t => t.length > 20);

  // Embed all chunks
  console.log(`   → Embedding ${texts.length} chunks...`);
  const embeddings = await embedBatch(texts, 32, 200);

  // Prepare rows for Supabase upsert
  const rows = texts.map((text, i) => ({
    content: text,
    source_type: source.source_type,
    embedding: embeddings[i],
    metadata: {
      page: chunks[i].metadata?.page,
      source_file: source.file
    }
  }));

  // Upsert in batches of 100 (Supabase recommended batch size)
  const UPSERT_BATCH = 100;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase.from("gita_chunks").insert(batch);

    if (error) {
      console.error(`   ❌ Upsert error at batch ${i}:`, error.message);
    } else {
      console.log(`   ✅ Stored ${Math.min(i + UPSERT_BATCH, rows.length)}/${rows.length} rows`);
    }
  }
}

async function main() {
  console.log("🕉️  Gita Mirror — Ingest Pipeline Starting\n");

  // Place your PDFs in /pdfs folder at project root
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR);
    console.log("Created /pdfs directory — add your PDF files there and re-run.");
    return;
  }

  for (const source of SOURCE_MAP) {
    await ingestPDF(source);
  }

  console.log("\n✅ Ingest complete. All 7 PDFs embedded into Supabase.");

  // Print storage estimate
  const { count } = await supabase
    .from("gita_chunks")
    .select("*", { count: "exact", head: true });

  console.log(`📊 Total chunks stored: ${count}`);
  console.log(`💾 Estimated storage: ~${((count || 0) * 1536 / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error);
```

Run with:
```bash
npx ts-node --project tsconfig.json scripts/ingest.ts
```

**Expected runtime:** 30–60 minutes for all 7 PDFs (HuggingFace free tier rate limits).  
**Tip:** Run overnight. It's a one-time operation.

---

## Stage 2: Retrieval System

### Step 2.1 — Emotion Classifier

Create `lib/classifier.ts`:

```typescript
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type EmotionalState =
  | "directionless"
  | "grief"
  | "burnout"
  | "seeking_depth"
  | "seeking_sharp_answer"
  | "general";

type SourceTypes = string[];

// Maps emotional states to source_type arrays
const RETRIEVAL_ROUTING: Record<EmotionalState, { primary: SourceTypes; secondary: SourceTypes }> = {
  directionless:        { primary: ["bg_as_it_is", "ttd"],          secondary: ["general_exp"] },
  grief:                { primary: ["swamy_bg", "general_exp"],      secondary: ["ttd"] },
  burnout:              { primary: ["bg_as_it_is", "g279"],          secondary: ["sloka117"] },
  seeking_depth:        { primary: ["general_exp", "essay"],         secondary: ["g279"] },
  seeking_sharp_answer: { primary: ["swamy_bg", "g279"],             secondary: [] },
  general:              { primary: ["bg_as_it_is", "g279", "ttd"],   secondary: ["general_exp"] }
};

export async function classifyEmotionalState(message: string): Promise<EmotionalState> {
  const response = await groq.chat.completions.create({
    model: "llama3-8b-8192", // Use fast model for classification — save 70B for generation
    max_tokens: 20,
    messages: [
      {
        role: "system",
        content: `You are an emotional state classifier. Given a user message, respond with EXACTLY ONE of these labels and nothing else:
directionless | grief | burnout | seeking_depth | seeking_sharp_answer | general

directionless = lost, no purpose, confused about life path, comparing to others
grief = loss, heartbreak, failure, death, disappointment, rejection  
burnout = exhausted, tired, no motivation, questioning work/effort
seeking_depth = wants detailed explanation, philosophical inquiry
seeking_sharp_answer = wants concise, direct wisdom
general = anything else`
      },
      { role: "user", content: message }
    ]
  });

  const label = response.choices[0]?.message?.content?.trim().toLowerCase() as EmotionalState;
  return RETRIEVAL_ROUTING[label] ? label : "general";
}

export function getSourceTypes(state: EmotionalState): SourceTypes {
  const routing = RETRIEVAL_ROUTING[state];
  return [...routing.primary, ...routing.secondary];
}
```

---

### Step 2.2 — Retriever

Create `lib/retriever.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import { embedText } from "./embedder";
import { classifyEmotionalState, getSourceTypes } from "./classifier";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface RetrievedChunk {
  content: string;
  source_type: string;
  chapter: number | null;
  verse: number | null;
  similarity: number;
}

export async function retrieveRelevantChunks(
  userMessage: string,
  matchCount = 5
): Promise<RetrievedChunk[]> {
  // Step 1: Classify emotional state
  const emotionalState = await classifyEmotionalState(userMessage);
  const sourceTypes = getSourceTypes(emotionalState);

  console.log(`[retriever] Emotional state: ${emotionalState}`);
  console.log(`[retriever] Routing to: ${sourceTypes.join(", ")}`);

  // Step 2: Embed the user message
  const queryEmbedding = await embedText(userMessage);

  // Step 3: Similarity search in Supabase
  const { data, error } = await supabase.rpc("match_gita_chunks", {
    query_embedding: queryEmbedding,
    source_types: sourceTypes,
    match_count: matchCount
  });

  if (error) {
    console.error("[retriever] Supabase RPC error:", error);
    return [];
  }

  return data as RetrievedChunk[];
}
```

---

## Stage 3: Generation Layer

### Step 3.1 — Krishna-Mirror System Prompt

Create `lib/prompts.ts`:

```typescript
export const KRISHNA_MIRROR_PROMPT = `You are a reflective guide rooted in the wisdom of the Bhagavad Gita.

Your role is not to give answers — it is to help the person find their own answer, as Krishna guided Arjuna not by commanding him, but by illuminating the truth already within him.

You will be given relevant passages from the Bhagavad Gita. Use them not as quotes to recite, but as lenses through which to craft one powerful reflective question.

How you respond:
1. First, briefly acknowledge the person's pain or confusion — 1 to 2 sentences, with warmth, not clinical distance.
2. Optionally, weave in a paraphrased insight from the Gita passages provided — naturally, not as a lecture.
3. End with ONE reflective question — not a list of questions. One. Make it count.

Rules you never break:
- Never prescribe what the person should do.
- Never say "you should", "you must", "I suggest."
- Ask one question per response. Never two.
- Never introduce yourself as an AI or a chatbot.
- Never quote shlokas verbatim — paraphrase the wisdom instead.
- Speak with warmth, not authority. Like a wise elder, not a professor.
- If the person seems to be in acute distress or mentions self-harm, gently say: "What you're carrying sounds very heavy. I'm here to reflect with you, but for what you're feeling right now, please consider reaching out to iCall at 9152987821 — they are trained to truly help."

The tone: grounded, human, wise. Not mystical or preachy. Not robotic or clinical.
You are a mirror, not a map.`;

export function buildContextFromChunks(chunks: Array<{ content: string; source_type: string }>): string {
  if (chunks.length === 0) return "";

  const formatted = chunks
    .map((c, i) => `[Gita Passage ${i + 1} — ${c.source_type}]\n${c.content}`)
    .join("\n\n");

  return `Relevant passages from the Bhagavad Gita:\n\n${formatted}`;
}
```

---

### Step 3.2 — Chat API Route

Create `app/api/chat/route.ts`:

```typescript
import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { retrieveRelevantChunks } from "@/lib/retriever";
import { KRISHNA_MIRROR_PROMPT, buildContextFromChunks } from "@/lib/prompts";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  // messages = array of {role: 'user'|'assistant', content: string}
  // Keep last 6 turns for conversation history
  const recentHistory = messages.slice(-6);
  const latestUserMessage = recentHistory.findLast(
    (m: { role: string }) => m.role === "user"
  )?.content ?? "";

  // Stage 2: Retrieve relevant Gita chunks
  const chunks = await retrieveRelevantChunks(latestUserMessage);
  const gitaContext = buildContextFromChunks(chunks);

  // Stage 3: Build final prompt and stream response
  const stream = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    max_tokens: 500,
    stream: true,
    messages: [
      { role: "system", content: KRISHNA_MIRROR_PROMPT },
      ...(gitaContext
        ? [{ role: "system" as const, content: gitaContext }]
        : []),
      ...recentHistory
    ]
  });

  // Stream tokens back to the client
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? "";
        if (token) {
          controller.enqueue(encoder.encode(token));
        }
      }
      controller.close();
    }
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked"
    }
  });
}
```

---

## Testing the RAG Pipeline

### Test 1 — Verify Ingest
```sql
-- Run in Supabase SQL Editor after ingest
SELECT source_type, COUNT(*) as chunk_count
FROM gita_chunks
GROUP BY source_type
ORDER BY chunk_count DESC;
```
Expected output: 7 rows, each with 5,000–15,000 chunks.

### Test 2 — Verify Embeddings
```sql
-- Check embedding dimensions
SELECT id, array_length(embedding::real[], 1) as dims
FROM gita_chunks
LIMIT 5;
```
Expected: `dims = 384` for all rows.

### Test 3 — Manual Retrieval Test
```sql
-- This won't work directly (need to embed a query), but verifies the function exists
SELECT * FROM match_gita_chunks(
  array_fill(0.0, ARRAY[384])::vector,  -- dummy zero vector
  ARRAY['g279', 'bg_as_it_is'],
  3
);
```

### Test 4 — End-to-End API Test
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "I feel completely lost. Everyone around me is succeeding and I have no idea what I want to do with my life."}
    ]
  }'
```
Expected: A streaming response acknowledging the pain and ending with one reflective question.

---

## Ingest Checklist

- [ ] `/pdfs` folder created at project root
- [ ] All 7 PDF files placed in `/pdfs` with exact names matching `sourceMap.ts`
- [ ] `.env.local` configured with all 4 environment variables
- [ ] Supabase SQL schema executed (vector extension + table + index + RPC function)
- [ ] `npm run ingest` completes without errors
- [ ] Supabase shows ~50,000–70,000 rows in `gita_chunks` table
- [ ] Retrieval test returns relevant chunks for a sample emotional query
- [ ] `/api/chat` endpoint streams a coherent response

---

## Estimated Timeline

| Task | Time |
|---|---|
| Environment setup + schema | 1 hour |
| Place PDFs, configure source map | 30 minutes |
| Run ingest script | 1–2 hours (runs in background) |
| Test retrieval + tune classifier | 2 hours |
| Build and test `/api/chat` route | 2 hours |
| End-to-end testing + prompt tuning | 2–3 hours |
| **Total** | **~8–10 hours** |

The ingest script can run overnight unattended. Active development time is approximately 6–8 hours.
