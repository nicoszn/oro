// Minimal k-means with k-means++ seeding, for training PQ codebooks
// over real embedding data instead of random init.

function sqDist(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

function normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map(x => x / (mag || 1));
}

// If there are fewer samples than clusters, jitter-duplicate until there
// are enough points for k to form non-empty clusters. Stopgap for small
// warm-up corpora — as real committed-block text accumulates in Tier2,
// this padding naturally becomes a no-op.
function padVectors(vectors: number[][], minCount: number): number[][] {
  if (vectors.length >= minCount) return vectors;
  const padded = [...vectors];
  let i = 0;
  while (padded.length < minCount) {
    const base = vectors[i % vectors.length];
    padded.push(base.map(v => v + (Math.random() - 0.5) * 0.01));
    i++;
  }
  return padded;
}

function kmeansPlusPlusInit(vectors: number[][], k: number): number[][] {
  const centroids: number[][] = [vectors[Math.floor(Math.random() * vectors.length)]];
  while (centroids.length < k) {
    const distances = vectors.map(v => Math.min(...centroids.map(c => sqDist(v, c))));
    const total = distances.reduce((a, b) => a + b, 0);
    if (total === 0) {
      centroids.push(vectors[Math.floor(Math.random() * vectors.length)]);
      continue;
    }
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < distances.length; idx++) {
      r -= distances[idx];
      if (r <= 0) break;
    }
    centroids.push(vectors[Math.min(idx, vectors.length - 1)]);
  }
  return centroids;
}

export function kmeans(rawVectors: number[][], k: number, iterations: number = 25): number[][] {
  const vectors = padVectors(rawVectors, k);
  const dim = vectors[0].length;
  const centroids = kmeansPlusPlusInit(vectors, k);
  const assignments = new Array(vectors.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < vectors.length; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = sqDist(vectors[i], centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      assignments[i] = best;
    }

    const sums = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < vectors.length; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let d = 0; d < dim; d++) sums[c][d] += vectors[i][d];
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c] = normalize(sums[c].map(v => v / counts[c]));
      }
      // empty cluster: leave centroid in place rather than reseeding mid-run
    }
  }

  return centroids;
}
