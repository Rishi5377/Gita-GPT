import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function probeColumns() {
  console.log("Probing columns and types in shloka_index...");
  
  // Try to insert a dummy record to see error messages or constraints
  const dummy = {
    chapter: 99,
    verse: 99,
    anchor_text: "Probe",
  };

  const { data, error } = await supabase
    .from('shloka_index')
    .insert([dummy])
    .select();

  if (error) {
    console.log("Insert Test Result (Error):", JSON.stringify(error, null, 2));
  } else {
    console.log("Insert Test Result (Success):", JSON.stringify(data, null, 2));
    // Clean up
    await supabase.from('shloka_index').delete().eq('chapter', 99).eq('verse', 99);
  }
}

probeColumns().catch(console.error);
