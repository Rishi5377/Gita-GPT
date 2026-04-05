# Tech Stack Document
# Gita Mirror — Technology Decisions & Rationale

**Version:** 1.0  
**Date:** April 2026  
**Status:** Finalized

---

## Stack at a Glance

| Layer | Technology | Tier | Cost |
|---|---|---|---|
| Frontend | Next.js 14 (App Router) | Free | ₹0 |
| Hosting | Vercel | Free | ₹0 |
| Vector Database | Supabase pgvector | Free (500MB) | ₹0 |
| Embedding Model | `all-MiniLM-L6-v2` via HuggingFace Inference API | Free | ₹0 |
| LLM (Inference) | Groq — Llama 3 70B | Free tier | ₹0 |
| PDF Parsing | LangChain PDF Loader + `pdf-parse` | Open source | ₹0 |
| Styling | Tailwind CSS + shadcn/ui | Open source | ₹0 |
| Language | TypeScript | — | ₹0 |
| **Total** | | | **₹0** |

---

## 1. Frontend — Next.js 14 (App Router)

### Why Next.js
- API routes built-in — no separate backend needed for v1
- Streaming support out of the box (Groq streams tokens, Next.js passes them to UI)
- Vercel deploys Next.js natively with zero config
- Strong portfolio signal — industry standard for full-stack React

### Key Next.js Features Used
- **App Router** — modern routing, layouts, server components
- **API Routes** — `/api/chat` and `/api/classify` as serverless functions
- **Server-Sent Events (SSE)** — stream LLM tokens to the client in real time
- **Environment Variables** — secure API key management via `.env.local`

### Why Not
- **Vite + React:** No built-in API routes, needs separate Express/FastAPI backend — more infra complexity
- **Plain HTML/JS:** No component reusability, poor DX for chat UIs

---

## 2. Hosting — Vercel

### Why Vercel
- Zero-config deployment for Next.js (same company)
- Free tier: unlimited deployments, 100GB bandwidth/month
- Public URL on every deploy — judges can demo instantly
- Environment variable management in dashboard
- No server management — pure serverless

### Deployment Flow
```
git push → Vercel auto-deploys → public URL live in ~60 seconds
```

### Why Not
- **Railway/Render:** Better for persistent servers, overkill for this project
- **Netlify:** Works, but Vercel + Next.js is the tightest integration

---

## 3. Vector Database — Supabase pgvector

### Why Supabase
- PostgreSQL-native — pgvector is a Postgres extension, not a separate service
- Free tier: 500MB database storage (our usage: ~160MB — comfortable headroom)
- No project pausing issues with occasional pings
- Metadata filtering built-in via standard SQL WHERE clauses
- One platform for potential future auth, storage, and realtime needs
- Portfolio-friendly: "I used Supabase pgvector" reads better than "I used ChromaDB locally"

### Storage Math (Confirmed Safe)
```
All 7 PDFs = 134MB
→ ~60,000 chunks at 300 tokens each
→ 384-dim embeddings = 384 × 4 bytes = 1,536 bytes/vector
→ 60,000 × 1,536 bytes = ~92MB (vectors)
→ + text content (~50MB) + metadata (~10MB)
→ Total: ~152MB ✅ Well within 500MB free tier
```

### Schema
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE gita_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT NOT NULL,
  source_type TEXT NOT NULL,      -- 'g279' | 'general_exp' | 'sloka117' | 'swamy_bg' | 'ttd' | 'bg_as_it_is' | 'essay'
  chapter     INT,
  verse       INT,
  embedding   VECTOR(384),        -- 384-dim for all-MiniLM-L6-v2
  metadata    JSONB DEFAULT '{}'
);

-- IVFFlat index for fast approximate nearest neighbor search
CREATE INDEX ON gita_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Retrieval Query Pattern
```sql
SELECT content, source_type, chapter, verse,
       1 - (embedding <=> $1) AS similarity
FROM gita_chunks
WHERE source_type = ANY($2)       -- filter by routed sources
ORDER BY embedding <=> $1          -- cosine similarity
LIMIT 5;
```

### Why Not
- **Pinecone:** External service, adds latency, free tier has vector limits
- **ChromaDB:** Local only — not deployable, no public URL
- **Weaviate:** More complex setup, overkill for v1

---

## 4. Embedding Model — `all-MiniLM-L6-v2`

### Why This Model
- 384 dimensions — small, fast, deployable
- Free via HuggingFace Inference API (no API key needed for public models)
- Excellent semantic similarity performance for philosophical/spiritual text
- Widely benchmarked — used in production by thousands of RAG pipelines
- Keeps vector storage at ~92MB vs ~368MB for 1536-dim models

### Embedding API Call
```typescript
const response = await fetch(
  "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: text })
  }
);
const [embedding] = await response.json();
// Returns: number[] of length 384
```

### Alternative Considered
- **OpenAI text-embedding-ada-002:** 1536 dims, $0.0001/1K tokens — not free, storage bloat
- **Gemini Embeddings:** Free but 768 dims, less community support for RAG pipelines
- **Decision:** `all-MiniLM-L6-v2` wins on cost + storage + community validation

---

## 5. LLM — Groq (Llama 3 70B)

### Why Groq
- **Speed:** Groq's LPU hardware delivers the fastest inference available — responses feel near-instant
- **Free tier:** Generous rate limits for portfolio-scale traffic
- **Model quality:** Llama 3 70B is a top-tier open model — significantly smarter than what 12GB RAM can run locally
- **Public deployment:** API-based, works on Vercel serverless functions (Ollama cannot)
- **Streaming support:** Native streaming — tokens appear as they're generated

### Model Selection
```
Primary:   llama3-70b-8192    (best reasoning, 8K context)
Fallback:  llama3-8b-8192     (faster, if rate limits hit)
```

### Context Window Usage per Request
```
System prompt (Krishna-mirror):  ~500 tokens
Retrieved Gita chunks (top 5):   ~1,500 tokens
Conversation history (6 turns):  ~800 tokens
User message:                    ~100 tokens
─────────────────────────────────────────────
Total input:                     ~2,900 tokens
Max output:                      ~500 tokens
Total per request:               ~3,400 tokens ✅ Well within 8K limit
```

### Why Not
- **Ollama:** Cannot deploy publicly, RAM-constrained (12GB), model quality limited
- **OpenAI GPT-4:** Paid, not free
- **Gemini Flash:** Good alternative but Groq is faster for chat use cases

---

## 6. PDF Parsing — LangChain + pdf-parse

### Why
- LangChain's `PDFLoader` handles multi-page PDFs cleanly
- `RecursiveCharacterTextSplitter` provides overlap-aware chunking
- Battle-tested for RAG ingest pipelines
- TypeScript-compatible

### Chunking Config
```typescript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 300,     // ~300 tokens per chunk
  chunkOverlap: 50,   // 50-token overlap to preserve context at boundaries
  separators: ["\n\n", "\n", ".", " "]
});
```

---

## 7. Styling — Tailwind CSS + shadcn/ui

### Why
- Tailwind: utility-first, no CSS files to manage, pairs perfectly with Next.js
- shadcn/ui: copy-paste components, no npm dependency bloat
- Together: fast to build, easy to customize the warm-earth aesthetic for Gita Mirror

### Design Direction
- Color palette: warm saffron, deep indigo, off-white parchment
- Typography: Serif for Gita text snippets, clean sans for UI
- Atmosphere: meditative, not clinical

---

## 8. Environment Variables

```env
# .env.local

GROQ_API_KEY=                    # Groq console → API Keys
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key (public)
SUPABASE_SERVICE_KEY=            # Supabase service role key (server-side only)
HF_API_TOKEN=                    # HuggingFace token (optional, increases rate limits)
```

---

## 9. Project Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "groq-sdk": "^0.3.0",
    "langchain": "^0.1.0",
    "@langchain/community": "^0.0.20",
    "pdf-parse": "^1.1.1",
    "tailwindcss": "^3.0.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "ts-node": "^10.0.0"
  }
}
```

---

## 10. Decision Log

| Decision | Chosen | Alternatives Considered | Reason |
|---|---|---|---|
| Frontend framework | Next.js 14 | Vite+React, plain HTML | Built-in API routes, Vercel native, streaming support |
| Hosting | Vercel | Railway, Netlify | Zero-config Next.js deploy, free, public URL |
| Vector DB | Supabase pgvector | Pinecone, ChromaDB, Weaviate | Free tier fits (152MB), SQL-native, one platform |
| Embedding model | all-MiniLM-L6-v2 (384d) | OpenAI ada-002, Gemini | Free, small vectors, excellent semantic quality |
| LLM provider | Groq (Llama 3 70B) | Ollama, OpenAI, Gemini | Fastest free inference, publicly deployable |
| Ingest scope | All 7 PDFs fully embedded | Partial (3-4 PDFs) | 152MB fits free tier; no compromise on dataset |
| Chunking | 300 tokens, 50 overlap | 500 tokens, no overlap | Balance between context and vector count |
| Language | TypeScript | JavaScript | Type safety, portfolio signal, Next.js native |
