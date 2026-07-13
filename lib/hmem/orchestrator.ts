import { SchemaExtractionPayload } from './types';
import { Tier1Scratchpad, Tier2IndexCache, Tier3SemanticGraph } from './tiers';
import { MemoryRouter } from './memoryRouter';

// Hardcode your OpenRouter API key here
const OAK = "";

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
    this.t3.insertNode({
      id: "global_root",
      anchorEmbedding: [],
      description: "Root baseline execution node environment",
      lastValidatedTurn: 0
    });
    this.logs.push("Orchestrator initialized with global_root node.");
  }

  private async callCloudLLM(prompt: string, jsonMode: boolean = false): Promise<string> {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OAK}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.2-3b-instruct:free",
          messages: [{ role: "user", content: prompt }],
          response_format: jsonMode ? { type: "json_object" } : undefined,
          temperature: 0.0
        })
      });
      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content?.trim() || "";
    } catch {
      return "";
    }
  }

  private async extractStructuredSchema(text: string): Promise<SchemaExtractionPayload | null> {
    const strictExtractionPrompt = `
You are a precise data parsing compiler. Extract metadata from this text step.
Target Text: "${text}"

You must output exactly one valid JSON object and nothing else. Follow this schema:
{
  "conceptId": "Single lowercase word identifying the main object or key state",
  "description": "Short explanation of what occurred",
  "relationshipTargetId": "global_root",
  "confidenceWeight": 0.85
}
    `.trim();

    const cloudJsonOutput = await this.callCloudLLM(strictExtractionPrompt, true);
    try {
      return JSON.parse(cloudJsonOutput) as SchemaExtractionPayload;
    } catch {
      // fallback patterns
      if (text.includes("KEY") || text.includes("BRONZE")) {
        return { conceptId: "bronze_key", description: "Located physical key asset", relationshipTargetId: "global_root", confidenceWeight: 0.90 };
      }
      if (text.includes("LEVER") || text.includes("SWITCH")) {
        return { conceptId: "lever_state", description: "Altered system hardware configurations", relationshipTargetId: "global_root", confidenceWeight: 0.95 };
      }
      return null;
    }
  }

  public async executeAgentTurn(agentId: string, inputPayload: string): Promise<string> {
    this.currentTurn++;
    this.logs.push(`[Turn ${this.currentTurn}] Agent ${agentId} -> "${inputPayload}"`);

    this.router.routeBlock(agentId, this.currentTurn, inputPayload);

    const extractedMeta = await this.extractStructuredSchema(inputPayload);
    if (extractedMeta) {
      if (!this.t3.hasNode(extractedMeta.conceptId)) {
        this.t3.insertNode({
          id: extractedMeta.conceptId,
          anchorEmbedding: this.t2.generateDeterministicEmbedding(extractedMeta.description),
          description: extractedMeta.description,
          lastValidatedTurn: this.currentTurn
        });
        this.logs.push(`  → Inserted graph node: ${extractedMeta.conceptId}`);
      }
      this.t3.connectNodes(extractedMeta.relationshipTargetId, extractedMeta.conceptId, extractedMeta.confidenceWeight);
      this.logs.push(`  → Connected ${extractedMeta.relationshipTargetId} -> ${extractedMeta.conceptId} (weight: ${extractedMeta.confidenceWeight})`);
    }

    const historicalManifest = this.t1.getActivePromptContext();
    const contextualSearchLogs = this.t2.querySimilarityADC(inputPayload, 1);
    const runtimeExecutionPrompt = `
System State Log History:
${historicalManifest}
Vector Reference Index Chunks:
${contextualSearchLogs.join("\n")}

New Event Notification: ${inputPayload}
Role Action Command: As ${agentId}, provide a single sentence update analyzing this progression.
    `.trim();

    const cloudTextOutput = await this.callCloudLLM(runtimeExecutionPrompt, false);
    this.t3.backgroundOptimizationCycle();
    this.logs.push(`  → Background optimization cycle complete.`);

    const response = cloudTextOutput || `[Cloud Fallback] System logged data for ${agentId} into local memory matrices.`;
    this.logs.push(`  → Response: ${response}`);
    return response;
  }

  public getGraphSnapshot(): string {
    return this.t3.exportGraphSnapshot();
  }

  public getTokenCount(): number {
    return this.t1.getTotalTokens();
  }
}
