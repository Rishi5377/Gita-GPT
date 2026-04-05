import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testConnection() {
  try {
    const res = await supabase.from('shloka_index').select('id').limit(1);
    console.log("SELECT RES:", res);
  } catch (err) {
    console.error("SELECT ERR:", err);
  }
}

testConnection();
