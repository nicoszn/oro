export * from './types';
export { Tier1Scratchpad, Tier2IndexCache, Tier3SemanticGraph } from './tiers';
export { MemoryRouter } from './memoryRouter';
export { Orchestrator } from './orchestrator';

import { Tier1Scratchpad, Tier2IndexCache, Tier3SemanticGraph } from './tiers';
import { Orchestrator } from './orchestrator';

export async function runSimulation() {
  const t1 = new Tier1Scratchpad();
  const t2 = new Tier2IndexCache();
  const t3 = new Tier3SemanticGraph();
  const orchestrator = new Orchestrator(t1, t2, t3);

  const simulationSteps = [
    { agent: "Explorer_Agent", command: "Entered room 1 area. Located structural safe chest component. Found [BRONZE KEY] inside wall cabinet." },
    { agent: "Cartographer_Agent", command: "Verifying tracking coordinates for room 1 workspace. East doorway boundary requires system unlock metrics." },
    { agent: "Explorer_Agent", command: "Applied collected [BRONZE KEY] to east doorway. Interlocking latch disengaged. Moving to room 2 room space." },
    { agent: "Cartographer_Agent", command: "Updating layout models. Room 2 confirmed active node. Initiating baseline network sweeps." },
    { agent: "Explorer_Agent", command: "Discovered active electrical breaker layout panel inside room 2. Pulled high-voltage switch lever downward." }
  ];

  for (const step of simulationSteps) {
    await orchestrator.executeAgentTurn(step.agent, step.command);
  }

  return {
    logs: orchestrator.logs,
    graphSnapshot: orchestrator.getGraphSnapshot(),
    finalTokenCount: orchestrator.getTokenCount()
  };
}
