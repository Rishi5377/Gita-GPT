import { createClient } from "@supabase/supabase-js";

import { embedText } from "../../../scripts/embedder";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function embedQuery(query: string): Promise<number[]> {
  try {
    return await embedText(query);
  } catch (error) {
    console.error("Direct embedding error:", error);
    throw error;
  }
}

export async function retrieveContext(query: string) {
  try {
    const vector = await embedQuery(query);

    // 1. Search for most relevant chunks
    // Note: This requires a 'match_gita_chunks' RPC in Supabase
    const { data: chunks, error: chunkError } = await supabase.rpc(
      "match_gita_chunks",
      {
        query_embedding: vector,
        match_threshold: 0.5,
        match_count: 5,
      }
    );

    if (chunkError) throw chunkError;

    // 2. Identify the most dominant Shloka from the chunks
    // We look for the most frequent shloka_id in the results
    const shlokaIds = chunks
      ?.map((c: { shloka_id: string }) => c.shloka_id)
      .filter((id: string | null) => id !== null);
    
    let masterShloka = null;
    if (shlokaIds && shlokaIds.length > 0) {
      const topShlokaId = shlokaIds.sort(
        (a: string, b: string) =>
          shlokaIds.filter((v: string) => v === a).length -
          shlokaIds.filter((v: string) => v === b).length
      ).pop();

      const { data: shlokaData } = await supabase
        .from("shloka_index")
        .select("*")
        .eq("id", topShlokaId)
        .single();
      
      masterShloka = shlokaData;
    }

    return {
      chunks: chunks || [],
      masterShloka,
    };
  } catch (error) {
    console.error("Retrieval error:", error);
    return { chunks: [], masterShloka: null };
  }
}
