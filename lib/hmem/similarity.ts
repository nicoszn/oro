export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  // Vectors are already unit-normalized (embedText normalizes on output),
  // so dot product == cosine similarity.
  return Math.max(0, Math.min(1, dot));
}
