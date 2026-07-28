import { recall, record } from "./episodic";
import { commitFact } from "./team";

export interface MemoryRouterOptions {
  agentId: string;
  taskId: string;
  taskType: string;
}

/**
 * Routes read/write requests to the appropriate memory tier.
 * All decisions are rule‑based – no LLM.
 */
export class MemoryRouter {
  constructor(private opts: MemoryRouterOptions) {}

  async read(query: string, k = 5) {
    // Currently only episodic memory is used for free‑text recall.
    // Team facts are accessed via explicit fact keys.
    return recall(this.opts.agentId, this.opts.taskType, query, k);
  }

  async writeEpisodic(summary: string, outcome: string) {
    await record(this.opts.agentId, this.opts.taskType, summary, outcome);
  }

  async writeTeamFact(factKey: string, factValue: unknown) {
    await commitFact(this.opts.agentId, this.opts.taskId, factKey, factValue);
  }
}
