import { TokenBlock, QuantizedVector, GlobalSemanticGraph, GraphNode, GraphEdge } from './types';
import { embedText, EMBEDDING_DIM } from './embeddings';
import { kmeans } from './kmeans';
import { cosineSimilarity } from './similarity';

export class Tier1Scratchpad {
  private buffer: TokenBlock[] = [];
  private readonly MAX_LOCAL_TOKENS = 1024;

  public static calculateTokens(text: string): number {
    if (!text) return 0;
    const cleanText = text.trim();
    const words = cleanText.split(/\s+/).length;
    const punctuationCount = (cleanText.match(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g) || []).length;
    return Math.ceil((words * 1.3) + punctuationCount);
  }

  public appendBlock(block: TokenBlock): TokenBlock[] {
    this.buffer.push(block);
    const evictedBlocks: TokenBlock[] = [];
    while (this.getTotalTokens() > this.MAX_LOCAL_TOKENS) {
      const popped = this.buffer.shift();
      if (popped) evictedBlocks.push(popped);
    }
    return evictedBlocks;
  }

  public getTotalTokens(): number {
    return this.buffer.reduce((acc, b) => acc + b.tokenCount, 0);
  }

  public getActivePromptContext(): string {
    return this.buffer.map(b => `[Timestamp: ${b.timestamp}] ${b.content}`).join("\n");
  }
}

export class Tier2IndexCache {
  private storagePool: QuantizedVector[] = [];
  private codebooks: number[][][] = [];
  private readonly SUBSPACES = 8;
  private readonly CENTROID_COUNT = 256;
  private readonly SUBSPACE_DIM = EMBEDDING_DIM / 8; // 48, tied to real embedding dim now
  private trained = false;

  constructor() {
    // Random init remains as a fallback so the class stays usable before
    // trainCodebooks() runs — but call trainCodebooks() before any real
    // commitBlock traffic, or quantization quality will be mediocre.
    this.initializeQuantizationCodebooks();
  }

  public isCodebookTrained(): boolean {
    return this.trained;
  }

  /** Dump current quantized vectors for persistence. */
  public exportVectors(): QuantizedVector[] {
    return this.storagePool;
  }

  /** Load previously persisted vectors — bypasses re-quantization since indices are already computed. */
  public hydrateVectors(vectors: QuantizedVector[]): void {
    this.storagePool.push(...vectors);
  }

  /** Dump trained codebooks for persistence. */
  public exportCodebooks(): number[][][] {
    return this.codebooks;
  }

  /** Load previously trained codebooks — skips retraining on restart. */
  public hydrateCodebooks(codebooks: number[][][]): void {
    this.codebooks = codebooks;
    this.trained = true;
  }

  /**
   * Replace the random-init codebooks with ones fit via k-means over real
   * embeddings. Run once at startup with a seed corpus (see corpus.ts);
   * re-run periodically against accumulated real Tier2 text for better fit
   * as usage grows.
   */
  public async trainCodebooks(corpus: string[]): Promise<void> {
    const embeddings = await Promise.all(corpus.map(text => embedText(text)));

    for (let s = 0; s < this.SUBSPACES; s++) {
      const sliceStart = s * this.SUBSPACE_DIM;
      const subVectors = embeddings.map(e => e.slice(sliceStart, sliceStart + this.SUBSPACE_DIM));
      this.codebooks[s] = kmeans(subVectors, this.CENTROID_COUNT);
    }
    this.trained = true;
  }

  private initializeQuantizationCodebooks(): void {
    for (let s = 0; s < this.SUBSPACES; s++) {
      const subspaceCentroids: number[][] = [];
      for (let c = 0; c < this.CENTROID_COUNT; c++) {
        const vector = Array.from({ length: this.SUBSPACE_DIM }, () => Math.random() * 2 - 1);
        const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
        subspaceCentroids.push(vector.map(v => v / (magnitude || 1)));
      }
      this.codebooks.push(subspaceCentroids);
    }
  }

  /**
   * Real semantic embedding (was: deterministic sine-hash noise).
   * Kept async — every caller downstream now awaits this.
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    return embedText(text);
  }

  public async commitBlock(id: string, text: string): Promise<void> {
    const rawEmbedding = await this.generateEmbedding(text);
    const compressedIndices = new Uint8Array(this.SUBSPACES);
    for (let s = 0; s < this.SUBSPACES; s++) {
      const sliceStart = s * this.SUBSPACE_DIM;
      const subVector = rawEmbedding.slice(sliceStart, sliceStart + this.SUBSPACE_DIM);
      let bestCentroidIndex = 0;
      let minDistance = Infinity;
      for (let c = 0; c < this.CENTROID_COUNT; c++) {
        const centroid = this.codebooks[s][c];
        let dist = 0;
        for (let d = 0; d < this.SUBSPACE_DIM; d++) {
          const diff = subVector[d] - centroid[d];
          dist += diff * diff;
        }
        if (dist < minDistance) {
          minDistance = dist;
          bestCentroidIndex = c;
        }
      }
      compressedIndices[s] = bestCentroidIndex;
    }
    this.storagePool.push({ blockId: id, subspaceCentroids: compressedIndices, rawTextReference: text });
  }

  public async querySimilarityADC(queryText: string, topK: number = 2, precomputedEmbedding?: number[]): Promise<string[]> {
    const unquantizedQuery = precomputedEmbedding ?? await this.generateEmbedding(queryText);
    const scoredPool = this.storagePool.map(vectorItem => {
      let totalAsymmetricScore = 0;
      for (let s = 0; s < this.SUBSPACES; s++) {
        const sliceStart = s * this.SUBSPACE_DIM;
        const querySubVector = unquantizedQuery.slice(sliceStart, sliceStart + this.SUBSPACE_DIM);
        const targetedCentroid = this.codebooks[s][vectorItem.subspaceCentroids[s]];
        let dotProduct = 0, qMag = 0, cMag = 0;
        for (let d = 0; d < this.SUBSPACE_DIM; d++) {
          dotProduct += querySubVector[d] * targetedCentroid[d];
          qMag += querySubVector[d] * querySubVector[d];
          cMag += targetedCentroid[d] * targetedCentroid[d];
        }
        const cosineSubspaceSim = dotProduct / (Math.sqrt(qMag) * Math.sqrt(cMag) || 1);
        totalAsymmetricScore += cosineSubspaceSim;
      }
      return { text: vectorItem.rawTextReference, score: totalAsymmetricScore / this.SUBSPACES };
    });
    return scoredPool.sort((a, b) => b.score - a.score).slice(0, topK).map(item => item.text);
  }
}

export class Tier3SemanticGraph {
  private graph: GlobalSemanticGraph = { nodes: new Map(), edges: [] };
  private readonly PRUNE_THRESHOLD = 0.20;

  public insertNode(node: GraphNode): void {
    this.graph.nodes.set(node.id, node);
  }

  public hasNode(id: string): boolean {
    return this.graph.nodes.has(id);
  }

  public getNode(id: string): GraphNode | undefined {
    return this.graph.nodes.get(id);
  }

  public getAllNodes(): GraphNode[] {
    return Array.from(this.graph.nodes.values());
  }

  public getAllEdges(): GraphEdge[] {
    return this.graph.edges;
  }

  /** Dump current graph state for persistence. */
  public exportState(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return { nodes: this.getAllNodes(), edges: this.getAllEdges() };
  }

  /** Load previously persisted graph state — call before any insertNode calls. */
  public hydrate(nodes: GraphNode[], edges: GraphEdge[]): void {
    nodes.forEach(n => this.graph.nodes.set(n.id, n));
    this.graph.edges.push(...edges);
  }

  public touchNode(id: string, turn: number): void {
    const node = this.graph.nodes.get(id);
    if (node) node.lastValidatedTurn = turn;
  }

  /**
   * Read path into the graph: given a query embedding, find the most
   * relevant nodes and their 1-hop neighbors, formatted for direct
   * injection into an agent prompt. Without this, Tier3 is write-only —
   * nodes and edges accumulate but never inform what an agent actually
   * sees.
   */
  public queryRelevantSubgraph(queryEmbedding: number[], topK: number = 3, hops: number = 1): string {
    if (queryEmbedding.length === 0) return "(no query context available)";

    const scored = this.getAllNodes()
      .filter(n => n.anchorEmbedding.length > 0)
      .map(n => ({ node: n, score: cosineSimilarity(queryEmbedding, n.anchorEmbedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (scored.length === 0) return "(graph has no scored nodes yet)";

    const lines: string[] = [];
    const visited = new Set<string>();

    for (const { node, score } of scored) {
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      lines.push(`- ${node.id}: ${node.description} (relevance ${score.toFixed(3)})`);

      if (hops > 0) {
        const neighborEdges = this.graph.edges.filter(
          e => e.sourceId === node.id || e.targetId === node.id
        );
        for (const edge of neighborEdges) {
          const neighborId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
          if (visited.has(neighborId)) continue;
          const neighborNode = this.graph.nodes.get(neighborId);
          if (neighborNode) {
            visited.add(neighborId);
            lines.push(`   ↳ related: ${neighborNode.id}: ${neighborNode.description} (edge weight ${edge.weight.toFixed(3)})`);
          }
        }
      }
    }

    return lines.join("\n");
  }

  public connectNodes(source: string, target: string, startingWeight: number): void {
    if (!this.graph.nodes.has(source) || !this.graph.nodes.has(target)) return;
    const existingEdge = this.graph.edges.find(e => e.sourceId === source && e.targetId === target);
    if (existingEdge) {
      existingEdge.weight = Math.min(1, existingEdge.weight + 0.1);
    } else {
      this.graph.edges.push({ sourceId: source, targetId: target, weight: startingWeight });
    }
  }

  public backgroundOptimizationCycle(): void {
    this.graph.edges = this.graph.edges.filter(edge => edge.weight >= this.PRUNE_THRESHOLD);
    const activeConnections = new Set<string>();
    this.graph.edges.forEach(edge => {
      activeConnections.add(edge.sourceId);
      activeConnections.add(edge.targetId);
    });
    for (const [nodeId] of this.graph.nodes.entries()) {
      if (nodeId !== "global_root" && !activeConnections.has(nodeId)) {
        this.graph.nodes.delete(nodeId);
      }
    }
  }

  public exportGraphSnapshot(): string {
    return JSON.stringify({
      nodesInSystem: this.graph.nodes.size,
      activeRelationalEdges: this.graph.edges.length,
      nodes: Array.from(this.graph.nodes.values()).map(n => ({ id: n.id, desc: n.description })),
      edges: this.graph.edges
    }, null, 2);
  }
}
