import { createClient } from "@supabase/supabase-js";
import { embedQuery } from "../src/services/database/retriever";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testRetrieval(userQuery: string) {
  console.log(`\n🔍 Query: "${userQuery}"`);
  
  // 1. Generate local embedding (The "Breaking Down" phase)
  console.log("🛠️  Generating weightless embedding via Public Inference API...");
  const vector = await embedQuery(userQuery);

  // 2. Vector Search in Supabase (The "Coordinate Matching" phase)
  console.log("🛰️  Matching coordinates in Supabase...");
  const { data: chunks, error: chunkError } = await supabase.rpc(
    "match_gita_chunks",
    {
      query_embedding: vector,
      match_threshold: 0.3, // Lower threshold for testing
      match_count: 3
    }
  );

  if (chunkError) {
    console.error("❌ RPC Error:", chunkError.message);
    return;
  }

  if (!chunks || chunks.length === 0) {
    console.log("⚠️ No relevant shlokas found.");
    return;
  }

  console.log(`✅ Found ${chunks.length} relevant chunks.\n`);

  // 3. Fetch Master Metadata for the Top Result
  const topChunk = chunks[0];
  console.log(`📖 Top Match: ${topChunk.shloka_id} (Score: ${topChunk.similarity.toFixed(4)})`);
  
  const { data: shloka, error: shlokaError } = await supabase
    .from("shloka_index")
    .select("*")
    .eq("id", topChunk.shloka_id)
    .single();

  if (shloka) {
    console.log(`--- Gita Mirror Master Index ---`);
    console.log(`Anchor Text: "${shloka.anchor_text}"`);
    console.log(`Primary Emotion: ${shloka.emotions?.[0] || 'None'}`);
    console.log(`Themes: ${shloka.themes?.join(", ")}`);
    console.log(`Trigger Scenario: ${shloka.trigger_scenario}`);
  }
}

// Test with a sample query
const query = process.argv[2] || "I don't know what to do in this situation.";
testRetrieval(query).catch(console.error);
