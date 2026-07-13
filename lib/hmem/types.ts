export interface TokenBlock {
  id: string;
  timestamp: number;
  content: string;
  tokenCount: number;
  avgAttentionWeight: number;
}

export interface QuantizedVector {
  blockId: string;
  subspaceCentroids: Uint8Array;
  rawTextReference: string;
}

export interface GraphNode {
  id: string;
  anchorEmbedding: number[];
  description: string;
  lastValidatedTurn: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  weight: number;
}

export interface GlobalSemanticGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

export interface SchemaExtractionPayload {
  conceptId: string;
  description: string;
  relationshipTargetId: string;
  confidenceWeight: number;
}
