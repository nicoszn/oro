import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

// Singleton pipeline — model loads once per server process, not per call.
// all-MiniLM-L6-v2: 384-dim, fast, good general-purpose semantic quality.
// Matches your existing PQ layout exactly: SUBSPACES(8) * SUBSPACE_DIM(48) = 384.
export const EMBEDDING_DIM = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    ) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

/**
 * Real semantic embedding, mean-pooled + L2-normalized (unit vectors,
 * so dot product == cosine similarity — matches assumptions already
 * baked into cosineSimilarity() and the ADC scoring in tiers.ts).
 */
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

// Warm the model at server boot (call once from your API route module scope
// or a Next.js instrumentation.ts) to avoid a cold-start delay on first request.
export async function warmEmbeddingModel(): Promise<void> {
  await getExtractor();
}
