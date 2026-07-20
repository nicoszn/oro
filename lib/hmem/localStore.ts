import fs from 'fs';
import path from 'path';
import { QuantizedVector, GraphNode, GraphEdge } from './types';

/**
 * Drop-in alternative to persistence.ts's SQLite-backed MemoryStore —
 * same public API, so swapping to real SQLite later is a one-line import
 * change in index.ts, not a rewrite. Backed by a single JSON file instead
 * of a database engine: zero native deps, nothing to install, easy to
 * inspect by hand. Trade-off: whole-file read/write, no concurrent-writer
 * safety — fine for a single local dev process, not for production
 * concurrency. Move to persistence.ts when that starts to matter.
 */

interface StoreShape {
  t2Vectors: { blockId: string; rawText: string; subspaceIndices: number[] }[];
  t3Nodes: GraphNode[];
  t3Edges: GraphEdge[];
  codebooks: number[][][] | null;
  meta: Record<string, string>;
}

const EMPTY_STORE: StoreShape = {
  t2Vectors: [],
  t3Nodes: [],
  t3Edges: [],
  codebooks: null,
  meta: {}
};

export class LocalJSONStore {
  private filePath: string;
  private data: StoreShape;

  constructor(filePath: string = path.join(process.cwd(), 'data', 'hmem-store.json')) {
    this.filePath = filePath;
    this.data = this.load();
  }

  private load(): StoreShape {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return { ...EMPTY_STORE, ...JSON.parse(raw) };
    } catch {
      // No file yet, or unreadable — start fresh rather than throwing.
      return structuredClone(EMPTY_STORE);
    }
  }

  /** Atomic write: temp file + rename, so a crash mid-write can't corrupt the store. */
  private flush(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmpPath, this.filePath);
  }

  // ---- Tier2 vectors ----

  public saveT2Vectors(vectors: QuantizedVector[]): void {
    const byId = new Map(this.data.t2Vectors.map(v => [v.blockId, v]));
    for (const v of vectors) {
      byId.set(v.blockId, {
        blockId: v.blockId,
        rawText: v.rawTextReference,
        subspaceIndices: Array.from(v.subspaceCentroids)
      });
    }
    this.data.t2Vectors = Array.from(byId.values());
    this.flush();
  }

  public loadT2Vectors(): QuantizedVector[] {
    return this.data.t2Vectors.map(v => ({
      blockId: v.blockId,
      rawTextReference: v.rawText,
      subspaceCentroids: new Uint8Array(v.subspaceIndices)
    }));
  }

  // ---- Tier3 graph ----

  public saveGraph(nodes: GraphNode[], edges: GraphEdge[]): void {
    const nodesById = new Map(this.data.t3Nodes.map(n => [n.id, n]));
    nodes.forEach(n => nodesById.set(n.id, n));
    this.data.t3Nodes = Array.from(nodesById.values());

    const edgesByKey = new Map(this.data.t3Edges.map(e => [`${e.sourceId}::${e.targetId}`, e]));
    edges.forEach(e => edgesByKey.set(`${e.sourceId}::${e.targetId}`, e));
    this.data.t3Edges = Array.from(edgesByKey.values());

    this.flush();
  }

  public loadGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return { nodes: this.data.t3Nodes, edges: this.data.t3Edges };
  }

  // ---- Codebooks ----

  public saveCodebooks(codebooks: number[][][]): void {
    this.data.codebooks = codebooks;
    this.data.meta.codebooks_trained = 'true';
    this.flush();
  }

  public loadCodebooks(): number[][][] | null {
    if (this.data.meta.codebooks_trained !== 'true') return null;
    return this.data.codebooks;
  }

  // ---- Meta ----

  public setMeta(key: string, value: string): void {
    this.data.meta[key] = value;
    this.flush();
  }

  public getMeta(key: string): string | null {
    return this.data.meta[key] ?? null;
  }

  public close(): void {
    // No open handle to release with fs-based storage — kept for interface
    // parity with MemoryStore so index.ts doesn't need to branch on which
    // store implementation is in use.
  }
}
