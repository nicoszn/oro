import { SchemaExtractionPayload, EmitFn } from './types';
import { Tier1Scratchpad, Tier2IndexCache, Tier3SemanticGraph } from './tiers';
import { MemoryRouter } from './memoryRouter';
import { cosineSimilarity } from './similarity';

const OAK = process.env.OPENROUTER_API_KEY ?? "";

interface LLMCallMeta {
  emit?: EmitFn;
  agentId?: string;
  turn?: number;
  purpose: 'schema_extraction' | 'turn_analysis';
}

export class Orchestrator {
  private router: MemoryRouter;
  private currentTurn: number = 0;
  public logs: string[] = [];

  constructor(
    private t1: Tier1Scratchpad,
    private t2: Tier2IndexCache,
    private t3: Tier3SemanticGraph
  ) {
    this.router = new MemoryRouter(this.t1, this.t2, this.t3);
    if (!this.t3.hasNode("global_root")) {
      this.t3.insertNode({
        id: "global_root",
        anchorEmbedding: [],
        description: "Root baseline execution node environment",
        lastValidatedTurn: 0
      });
      this.logs.push("Orchestrator initialized with global_root node.");
    } else {
      this.logs.push("Orchestrator resumed with hydrated graph state.");
    }
  }

  private async callCloudLLM(prompt: string, jsonMode: boolean = false, meta?: LLMCallMeta): Promise<string> {
    const callId = meta ? `${meta.agentId}_t${meta.turn}_${meta.purpose}_${Date.now()}` : undefined;
    const startedAt = Date.now();

    if (meta?.emit && callId) {
      meta.emit({
        type: 'llm_call_start',
        timestamp: startedAt,
        turn: meta.turn,
        agentId: meta.agentId,
        message: `LLM call started (${meta.purpose})`,
        data: { callId, purpose: meta.purpose }
      });
    }

    const finish = (success: boolean, message: string, extra?: Record<string, unknown>) => {
      if (meta?.emit && callId) {
        meta.emit({
          type: 'llm_call_end',
          timestamp: Date.now(),
          turn: meta.turn,
          agentId: meta.agentId,
          message,
          data: { callId, purpose: meta.purpose, success, durationMs: Date.now() - startedAt, ...extra }
        });
      }
    };

    if (!OAK) {
      const msg = "OPENROUTER_API_KEY is not set in the environment.";
      console.error(msg);
      this.logs.push(`  ⚠ ${msg}`);
      finish(false, msg);
      return "";
    }
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OAK}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [{ role: "user", content: prompt }],
          response_format: jsonMode ? { type: "json_object" } : undefined,
          temperature: 0.0
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        const msg = `OpenRouter HTTP ${response.status}: ${errBody.slice(0, 300)}`;
        console.error(msg);
        this.logs.push(`  ⚠ ${msg}`);
        finish(false, msg);
        return "";
      }

      const data = await response.json() as any;
      if (data.error) {
        const msg = `OpenRouter API error: ${data.error.message || JSON.stringify(data.error)}`;
        console.error(msg);
        this.logs.push(`  ⚠ ${msg}`);
        finish(false, msg);
        return "";
      }
      const output = data.choices?.[0]?.message?.content?.trim() || "";
      finish(true, `LLM call finished (${meta?.purpose})`, { preview: output.slice(0, 160) });
      return output;
    } catch (err) {
      const msg = `OpenRouter request failed: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      this.logs.push(`  ⚠ ${msg}`);
      finish(false, msg);
      return "";
    }
  }

  private async extractStructuredSchema(text: string, meta?: LLMCallMeta): Promise<SchemaExtractionPayload | null> {
    const prompt = `
You are a precise data parser. Extract metadata from this text:
"${text}"

Output JSON:
{
  "conceptId": "single lowercase word for main object/state",
  "description": "short explanation",
  "relationshipTargetId": "global_root",
  "confidenceWeight": <number between 0 and 1, based on how certain you are and how important this concept is>
}
`.trim();

    const cloudJsonOutput = await this.callCloudLLM(prompt, true, meta);
    try {
      return JSON.parse(cloudJsonOutput) as SchemaExtractionPayload;
    } catch {
      return null;
    }
  }

  public async executeAgentTurn(agentId: string, inputPayload: string, emit?: EmitFn): Promise<string> {
    this.currentTurn++;
    const turn = this.currentTurn;
    this.logs.push(`[Turn ${turn}] Agent ${agentId} -> "${inputPayload}"`);

    emit?.({
      type: 'turn_start',
      timestamp: Date.now(),
      turn,
      agentId,
      message: `${agentId} started turn ${turn}`,
      data: { inputPayload }
    });

    // --- Routing: evicted Tier1 blocks get checked against the graph ---
    const routingDecisions = await this.router.routeBlock(agentId, turn, inputPayload);
    for (const d of routingDecisions) {
      this.logs.push(`  → ${d.message}`);
      emit?.({
        type: 'routing_decision',
        timestamp: Date.now(),
        turn,
        agentId,
        message: d.message,
        data: { blockId: d.blockId, destination: d.destination, score: d.score }
      });
    }

    // --- Schema extraction: LLM call #1, feeds the semantic graph ---
    const extractedMeta = await this.extractStructuredSchema(inputPayload, {
      emit, agentId, turn, purpose: 'schema_extraction'
    });

    if (extractedMeta) {
      emit?.({
        type: 'schema_extraction',
        timestamp: Date.now(),
        turn,
        agentId,
        message: `Extracted concept "${extractedMeta.conceptId}"`,
        data: { ...extractedMeta }
      });

      const newEmbedding = await this.t2.generateEmbedding(extractedMeta.description);
      const targetNode = this.t3.getNode(extractedMeta.relationshipTargetId);
      let similarity = 0.5;
      if (targetNode && targetNode.anchorEmbedding.length > 0) {
        similarity = cosineSimilarity(newEmbedding, targetNode.anchorEmbedding);
      }
      let finalWeight = (extractedMeta.confidenceWeight + similarity) / 2;
      finalWeight = Math.max(0, Math.min(1, finalWeight));

      if (!this.t3.hasNode(extractedMeta.conceptId)) {
        this.t3.insertNode({
          id: extractedMeta.conceptId,
          anchorEmbedding: newEmbedding,
          description: extractedMeta.description,
          lastValidatedTurn: turn
        });
        this.logs.push(`  → Inserted graph node: ${extractedMeta.conceptId}`);
        emit?.({
          type: 'graph_insert',
          timestamp: Date.now(),
          turn,
          agentId,
          message: `Inserted graph node "${extractedMeta.conceptId}"`,
          data: { nodeId: extractedMeta.conceptId, description: extractedMeta.description }
        });
      }
      this.t3.connectNodes(extractedMeta.relationshipTargetId, extractedMeta.conceptId, finalWeight);
      this.logs.push(`  → Connected ${extractedMeta.relationshipTargetId} -> ${extractedMeta.conceptId} (weight: ${finalWeight.toFixed(3)})`);
      emit?.({
        type: 'graph_connect',
        timestamp: Date.now(),
        turn,
        agentId,
        message: `Connected ${extractedMeta.relationshipTargetId} → ${extractedMeta.conceptId}`,
        data: { source: extractedMeta.relationshipTargetId, target: extractedMeta.conceptId, weight: finalWeight }
      });
    }

    // --- Retrieval: reuse one embedding for both T2 similarity and T3 graph lookup ---
    const historicalManifest = this.t1.getActivePromptContext();
    const queryEmbedding = await this.t2.generateEmbedding(inputPayload);
    const contextualSearchLogs = await this.t2.querySimilarityADC(inputPayload, 1, queryEmbedding);
    const graphContext = this.t3.queryRelevantSubgraph(queryEmbedding, 3, 1);

    emit?.({
      type: 'retrieval',
      timestamp: Date.now(),
      turn,
      agentId,
      message: `Retrieved ${contextualSearchLogs.length} T2 match(es) and graph context`,
      data: { vectorHits: contextualSearchLogs, graphContextPreview: graphContext }
    });

    const runtimeExecutionPrompt = `
System State Log History:
${historicalManifest}
Vector Reference Index Chunks:
${contextualSearchLogs.join("\n")}
Relevant Graph Context:
${graphContext}

New Event Notification: ${inputPayload}
Role Action Command: As ${agentId}, provide a single sentence update analyzing this progression.
    `.trim();

    // --- Main turn LLM call #2 ---
    const cloudTextOutput = await this.callCloudLLM(runtimeExecutionPrompt, false, {
      emit, agentId, turn, purpose: 'turn_analysis'
    });

    this.t3.backgroundOptimizationCycle();
    this.logs.push(`  → Background optimization cycle complete.`);

    if (!cloudTextOutput) {
      emit?.({
        type: 'error',
        timestamp: Date.now(),
        turn,
        agentId,
        message: `Cloud LLM call failed for agent ${agentId} at turn ${turn}`
      });
      throw new Error(`Cloud LLM call failed for agent ${agentId} at turn ${turn}`);
    }

    this.logs.push(`  → Response: ${cloudTextOutput}`);

    emit?.({
      type: 'turn_complete',
      timestamp: Date.now(),
      turn,
      agentId,
      message: cloudTextOutput,
      data: {
        tokenCount: this.t1.getTotalTokens(),
        graphNodes: this.t3.getAllNodes().length,
        graphEdges: this.t3.getAllEdges().length
      }
    });

    return cloudTextOutput;
  }

  public getGraphSnapshot(): string {
    return this.t3.exportGraphSnapshot();
  }

  public getTokenCount(): number {
    return this.t1.getTotalTokens();
  }
}
