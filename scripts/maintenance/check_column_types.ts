import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkColumnTypes() {
  console.log("Checking shloka_index column metadata...");
  // We can query the information_schema via a raw query if we had a direct connection, 
  // but with the SDK we'll just check if we can insert a sample and see if it fails.
  // Better: use an RPC if available, or just try to select one row and look at the types.
  
  const { data, error } = await supabase
    .from('shloka_index')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  if (data && data.length > 0) {
      const row = data[0];
      for (const key in row) {
          console.log(`Column: ${key}, Value Type: ${typeof row[key]}, IsArray: ${Array.isArray(row[key])}`);
      }
  } else {
      console.log("Table is empty. Cannot determine types via select.");
  }
}

checkColumnTypes().catch(console.error);
