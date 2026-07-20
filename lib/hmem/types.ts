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

export interface RoutingDecision {
  blockId: string;
  destination: 'tier2' | 'tier3' | 'dropped';
  message: string;
  score: number;
}

export type EngineEventType =
  | 'simulation_start'
  | 'turn_start'
  | 'routing_decision'
  | 'schema_extraction'
  | 'graph_insert'
  | 'graph_connect'
  | 'llm_call_start'
  | 'llm_call_end'
  | 'retrieval'
  | 'turn_complete'
  | 'simulation_complete'
  | 'error';

export interface EngineEvent {
  type: EngineEventType;
  timestamp: number;
  turn?: number;
  agentId?: string;
  message: string;
  data?: Record<string, unknown>;
}

export type EmitFn = (event: EngineEvent) => void;
