import { pipeline, env } from "@xenova/transformers";

// Cache model locally in .cache/ at project root
env.cacheDir = ".cache";

let embedder: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getEmbedder() {
  if (embedder) return embedder;

  console.log("Loading local embedding model (first run downloads 23MB)...");
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
    // @ts-ignore - 'normalize' exists at runtime but type definitions may mismatch
    normalize: true        // unit-normalize — required for cosine similarity
  });
  return Array.from((output as any).data) as number[];
}

export async function embedBatch(
  texts: string[],
  batchSize = 32,
  delayMs = 0              // no delay needed — local, no rate limits
): Promise<number[][]> {
  const model = await getEmbedder();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    // Process batch elements in parallel for speed
    const batchResults = await Promise.all(
      batch.map(async text => {
        // @ts-ignore - 'normalize' exists at runtime but type definitions may mismatch
        const output = await model(text, { pooling: "mean", normalize: true });
        return Array.from((output as any).data) as number[];
      })
    );

    embeddings.push(...batchResults);
    process.stdout.write(
      `\r   → Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks`
    );
  }

  process.stdout.write('\n'); // newline after progress
  return embeddings;
}
