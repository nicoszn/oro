import { TokenBlock, QuantizedVector, GlobalSemanticGraph, GraphNode, GraphEdge } from './types';

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
  private readonly SUBSPACE_DIM = 48;

  constructor() {
    this.initializeQuantizationCodebooks();
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

  public generateDeterministicEmbedding(text: string): number[] {
    const totalDimensions = this.SUBSPACES * this.SUBSPACE_DIM;
    const embedding = new Array<number>(totalDimensions);
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed = (seed << 5) - seed + text.charCodeAt(i);
      seed |= 0;
    }
    for (let d = 0; d < totalDimensions; d++) {
      const val = Math.sin(seed + d) * 10000;
      embedding[d] = val - Math.floor(val);
    }
    const mag = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / (mag || 1));
  }

  public commitBlock(id: string, text: string): void {
    const rawEmbedding = this.generateDeterministicEmbedding(text);
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

  public querySimilarityADC(queryText: string, topK: number = 2): string[] {
    const unquantizedQuery = this.generateDeterministicEmbedding(queryText);
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

  public connectNodes(source: string, target: string, startingWeight: number): void {
    if (!this.graph.nodes.has(source) || !this.graph.nodes.has(target)) return;
    const existingEdge = this.graph.edges.find(e => e.sourceId === source && e.targetId === target);
    if (existingEdge) {
      existingEdge.weight = 1 - (1 - existingEdge.weight) * (1 - startingWeight);
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
