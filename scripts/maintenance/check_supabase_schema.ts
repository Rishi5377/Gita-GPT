import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSchema() {
  console.log("Checking shloka_index row for columns...");
  const { data, error } = await supabase
    .from('shloka_index')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching shloka_index:", error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log("Current Columns:", Object.keys(data[0]));
  } else {
    console.log("No data found in shloka_index. Checking gita_chunks...");
    const { data: chunkData } = await supabase.from('gita_chunks').select('*').limit(1);
    if (chunkData && chunkData.length > 0) {
        console.log("gita_chunks columns:", Object.keys(chunkData[0]));
    }
  }
}

checkSchema().catch(console.error);
