import { createClient } from "@supabase/supabase-js";
import { embedText } from "../../../scripts/embedder";
import { extractUserIntent, UserIntent } from "@/services/ai/intent";

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

interface ShlokaRecord {
  id: string;
  chapter: number;
  verse: string;
  themes?: string[];
  emotions?: string[];
  keywords?: string[];
}

// Memory scoring function to find the most resonant Shloka
function scoreShloka(shloka: ShlokaRecord, intent: UserIntent) {
  let score = 0;
  
  if (shloka.emotions) {
    const eLower = shloka.emotions.map((e: string) => e.toLowerCase());
    intent.emotions.forEach(e => { if (eLower.includes(e)) score += 3; });
  }
  if (shloka.themes) {
    const tLower = shloka.themes.map((t: string) => t.toLowerCase());
    intent.themes.forEach(t => { if (tLower.includes(t)) score += 2; });
  }
  if (shloka.keywords) {
    const kLower = shloka.keywords.map((k: string) => k.toLowerCase());
    intent.keywords.forEach(k => { if (kLower.includes(k)) score += 1; });
  }
  
  return score;
}

export async function retrieveContext(query: string) {
  try {
    // ---- STEP 1: Intent Extraction & Metadata Query ----
    // This is the primary zero-weight engine for thematic RAG
    const intent = await extractUserIntent(query);
    
    if (intent) {
      const orQuery: string[] = [];
      const safeString = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, '');

      intent.emotions.forEach(exp => orQuery.push(`emotions.cs.{${safeString(exp)}}`));
      intent.themes.forEach(exp => orQuery.push(`themes.cs.{${safeString(exp)}}`));
      intent.keywords.forEach(exp => orQuery.push(`keywords.cs.{${safeString(exp)}}`));
      
      if (orQuery.length > 0) {
        const { data: shlokas, error } = await supabase
          .from("shloka_index")
          .select("*")
          .or(orQuery.join(','));
          
        if (!error && shlokas && shlokas.length > 0) {
          // Identify master shloka by highest overlap score
          const ranked = shlokas
            .map(s => ({ shloka: s, score: scoreShloka(s, intent) }))
            .sort((a, b) => b.score - a.score);
            
          const masterShloka = ranked[0].shloka;
          
          // Now fetch exactly the chunks linked to this shloka
          const { data: chunks } = await supabase
            .from("gita_chunks")
            .select("*")
            .eq("shloka_id", masterShloka.id)
            .limit(5);

          console.log(`🧠 [RAG] Thematic Match Found: BG ${masterShloka.chapter}.${masterShloka.verse} (Score: ${ranked[0].score})`);
          
          return {
            chunks: chunks || [],
            masterShloka
          };
        }
      }
    }

    console.log("⚠️ [RAG] Thematic Match missed. Falling back to Vector Search...");

    // ---- STEP 2: Fallback Vector Search ----
    const vector = await embedQuery(query);

    const { data: chunks, error: chunkError } = await supabase.rpc(
      "match_gita_chunks",
      {
        query_embedding: vector,
        match_threshold: 0.5,
        match_count: 5,
      }
    );

    if (chunkError) throw chunkError;

    const shlokaIds = chunks
      ?.map((c: { shloka_id: string }) => c.shloka_id)
      .filter((id: string | null) => id !== null);
    
    let masterShloka = null;
    if (shlokaIds && shlokaIds.length > 0) {
      // Find mode
      const counts: Record<string, number> = {};
      shlokaIds.forEach((id: string) => { counts[id] = (counts[id] || 0) + 1; });
      const topShlokaId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];

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
