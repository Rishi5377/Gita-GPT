import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SOURCE_MAP } from "./sourceMap";
import { embedBatch } from "./embedder";

dotenv.config();

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const ASSETS_DIR = path.join(process.cwd(), "Assets");

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

  if (error) {
    throw new Error(`Failed to load shloka_index: ${error.message}`);
  }

  shlokaCache = new Map(
    (data ?? []).map(row => [`${row.chapter}:${row.verse}`, row.id])
  );

  console.log(`📚 Loaded ${shlokaCache.size} shlokas from master index`);
  return shlokaCache;
}

/**
 * Extract chapter + verse from chunk text using multiple regex patterns
 */
function extractChapterVerse(text: string): { chapter: number; verse: number } | null {
  const patterns = [
    /\bBG\s+(\d+)[.\-:](\d+)\b/i,                          // BG 2.47, BG 2-47
    /\bChapter\s+(\d+)[,\s]+(?:Verse|Shloka|Sloka)\s+(\d+)/i, // Chapter 2, Verse 47
    /\b(\d+)\.(\d+)\b/,                                    // 2.47 (bare)
    /\[(\d+)[.:–](\d+)\]/,                                  // [2.47] or [2:47]
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const chapter = parseInt(match[1], 10);
      const verse = parseInt(match[2], 10);
      
      // Sanity check: Gita has 18 chapters, max verses ~78
      if (chapter >= 1 && chapter <= 18 && verse >= 1 && verse <= 85) {
        return { chapter, verse };
      }
    }
  }
  return null;
}

async function ingestPDF(source: typeof SOURCE_MAP[0], cache: Map<string, string>) {
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
    .map((c: any) => c.pageContent.trim())
    .filter((t: string) => t.length > 20);   // drop near-empty chunks

  console.log(`   → ${texts.length} chunks created`);

  // Embed all chunks via HuggingFace (free, 384-dim)
  console.log(`   → Generating embeddings via HuggingFace...`);
  const embeddings = await embedBatch(texts, 1, 0); // MiniLM is very fast on API

  // Build rows with shloka_id linking
  const rows = texts.map((text: string, i: number) => {
    const cv = extractChapterVerse(text);
    const shlokaId = cv ? cache.get(`${cv.chapter}:${cv.verse}`) ?? null : null;

    return {
      content: text,
      source_type: source.source_type,
      chapter: cv?.chapter ?? null,
      verse: cv?.verse ?? null,
      shloka_id: shlokaId,
      embedding: embeddings[i],
      metadata: {
        page: chunks[i]?.metadata?.page || null,
        source_file: source.file,
        linked: shlokaId !== null
      }
    };
  });

  const linkedCount = rows.filter((r: any) => r.shloka_id !== null).length;
  console.log(`   → ${linkedCount}/${rows.length} chunks linked to master index`);

  // Upload in batches
  const uploadBatchSize = 100;
  for (let i = 0; i < rows.length; i += uploadBatchSize) {
    const uploadBatch = rows.slice(i, i + uploadBatchSize);
    const { error } = await supabase.from("gita_chunks").insert(uploadBatch);

    if (error) {
      console.error(`   ❌ Batch upload failed:`, JSON.stringify(error, null, 2));
    } else {
      process.stdout.write(`\r   ✅ Uploaded ${Math.min(i + uploadBatchSize, rows.length)}/${rows.length} to DB...`);
    }
  }
  process.stdout.write('\n');
}

async function main() {
  console.log("🕉️  Gita Mirror Phase 4 — Vector Ingestion Pipeline\n");

  if (!fs.existsSync(ASSETS_DIR)) {
    console.error(`❌ Assets directory not found at: ${ASSETS_DIR}`);
    process.exit(1);
  }

  const cache = await getShlokaCache();
  if (cache.size === 0) {
    console.error("❌ shloka_index is empty. Populate master index first.");
    process.exit(1);
  }

  // Process sequential
  for (const source of SOURCE_MAP) {
    await ingestPDF(source, cache);
  }

  console.log("\n🎉 Phase 4 ingestion complete for all sources!\n");
}

main().catch(err => {
  console.error("❌ Fatal Ingestion Error:", err);
});
