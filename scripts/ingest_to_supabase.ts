import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const INDEX_DIR = path.join(__dirname, '..', 'Docs', 'master_index');

async function uploadIndex() {
  console.log(`\n🕉️  Initializing Supabase Ingestion Pipeline...`);
  console.log(`📍 Connecting to: ${supabaseUrl}`);

  const chapters = Array.from({ length: 18 }, (_, i) => i + 1);
  const allEntries: any[] = [];

  // Traverse through each chapter directory
  for (const chapter of chapters) {
    const chapterDir = path.join(INDEX_DIR, `chapter_${chapter}`);
    
    if (!fs.existsSync(chapterDir)) {
      continue;
    }

    const files = fs.readdirSync(chapterDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(chapterDir, file);
        const data = fs.readFileSync(filePath, 'utf-8');
        const entry = JSON.parse(data);
        
        if (entry && entry.chapter && entry.verse) {
          
          let parsedVerse = 0;
          if (typeof entry.verse === 'string') {
            parsedVerse = parseInt(entry.verse.split('-')[0].replace(/\D/g, ''), 10);
          } else {
            parsedVerse = entry.verse;
          }

          const flattenedEmotions = [
            ...(entry.emotions?.primary || []),
            ...(entry.emotions?.secondary || []),
            ...(entry.emotions?.shadow || [])
          ];

          const psychStateRaw = entry.psychological_state || [];
          const psychState = Array.isArray(psychStateRaw) ? psychStateRaw : [psychStateRaw];

          const keywordsRaw = entry.keywords || [];
          const keywordsArr = Array.isArray(keywordsRaw) ? keywordsRaw : [keywordsRaw];

          const themesRaw = entry.themes || [];
          const themesArr = Array.isArray(themesRaw) ? themesRaw : [themesRaw];

          allEntries.push({
            chapter: Number(entry.chapter),
            verse: parsedVerse,
            themes: themesArr,
            emotions: flattenedEmotions,
            keywords: keywordsArr,
            anchor_text: entry.anchor_text || entry.translation || "", // Use new anchor_text
            contextual_meaning: entry.contextual_meaning || "",
            psychological_state: psychState,
            trigger_scenario: entry.trigger_scenario || ""
          });
        }
      } catch (err: any) {
        console.error(`⚠️ Failed to parse file ${file}:`, err.message);
      }
    }
  }

  console.log(`\n📦 Total Shlokas Collected: ${allEntries.length}`);
  if (allEntries.length === 0) {
    console.error("❌ No verses found to upload.");
    return;
  }

  console.log(`📤 Uploading entries in batches to Supabase...`);

  const BATCH_SIZE = 50;
  let successCount = 0;

  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batch = allEntries.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase
      .from('shloka_index')
      .upsert(batch, { onConflict: 'chapter,verse', ignoreDuplicates: false });

    if (error) {
      console.error(`❌ Error uploading batch starting at index ${i}:`, JSON.stringify(error, null, 2));
    } else {
      successCount += batch.length;
      process.stdout.write(`\r✅ Uploaded ${Math.min(i + BATCH_SIZE, allEntries.length)} / ${allEntries.length} verses...`);
    }
  }

  console.log(`\n\n🎉 Ingestion Complete! successfully stored ${successCount} verses in the database.`);
}

uploadIndex().catch(err => console.error("Unhandled Exception:", err));
