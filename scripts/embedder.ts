// @ts-ignore - Xenova types are not exported in v2
import { pipeline, env } from "@xenova/transformers";

// Cache model locally in .cache/ at project root
env.cacheDir = ".cache";

// Skip type checking for the pipeline instance to avoid deep recursion errors in TS 5
let embedder: any = null;

async function getEmbedder() {
  if (embedder) return embedder;

  console.log("Loading local embedding model (Xenova/all-MiniLM-L6-v2)...");
  embedder = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );
  console.log("✅ Loaded local embedding model successfully");
  return embedder;
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, {
    pooling: "mean",
    normalize: true        // unit-normalize — required for cosine similarity
  });
  
  // Explicitly cast to the internal data structure to ensure type safety
  return Array.from(output.data as any) as number[];
}

export async function embedBatch(
  texts: string[],
  batchSize = 32
): Promise<number[][]> {
  const model = await getEmbedder();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async text => {
        const output = await model(text, { pooling: "mean", normalize: true });
        return Array.from(output.data as any) as number[];
      })
    );

    embeddings.push(...(batchResults as number[][]));
    process.stdout.write(
      `\r   → Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks`
    );
  }

  process.stdout.write('\n'); // newline after progress
  return embeddings;
}
