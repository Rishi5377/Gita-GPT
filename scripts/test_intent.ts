import { extractUserIntent } from "@/services/ai/intent";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testIntent() {
  const query = "I feel duty bound but confused";
  console.log(`🔍 User Query: "${query}"`);
  
  const intent = await extractUserIntent(query);
  console.log(`🧠 Extracted Intent:`, JSON.stringify(intent, null, 2));

  if (!intent) {
    console.error("❌ Failed to extract intent.");
    return;
  }

  // Build the OR conditions
  // Using 'cs' (contains) for jsonb arrays if we search individually, or 'ov' for pg arrays.
  // Actually, let's try searching individually to see if it works.
  
  // Since we want ANY match, we can pull all rows that match AT LEAST ONE emotion/theme/keyword
  
  // A safe way that works for JSONB in postgrest is to stringify the or query.
  // Let's see if we can use the `ov` operator.
  let orQuery = [];
  
  for (const exp of intent.emotions) {
    orQuery.push(`emotions.cs.{${exp}}`);
  }
  for (const exp of intent.themes) {
    orQuery.push(`themes.cs.{${exp}}`);
  }
  for (const exp of intent.keywords) {
    orQuery.push(`keywords.cs.{${exp}}`);
  }
  
  if (orQuery.length === 0) {
      console.log("No filters to apply.");
      return;
  }
  
  const orString = orQuery.join(',');
  console.log(`⚙️ Querying Supabase with: .or('${orString}')`);
  
  const { data, error } = await supabase
    .from("shloka_index")
    .select("chapter, verse, emotions, themes, keywords, anchor_text")
    .or(orString)
    .limit(5);

  if (error) {
    console.error("❌ Database Error:", error);
  } else {
    console.log(`✅ Found ${data?.length} matching shlokas:`);
    data?.forEach(row => {
      console.log(`\n📖 BG ${row.chapter}.${row.verse}`);
      console.log(`Anchor: ${row.anchor_text}`);
      console.log(`Emotions: ${row.emotions.slice(0,3).join(', ')}`);
    });
  }
}

testIntent();
