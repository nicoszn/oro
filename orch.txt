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

  // Four new agents with distinct names, roles, and one command each
  const simulationSteps = [
    {
      agent: "Security_Agent",
      command: "Scanned biometric authentication logs. Detected anomalous entry attempt at sector 7."
    },
    {
      agent: "Logistics_Agent",
      command: "Updated supply manifest. Crate #4421 missing from warehouse bay 3."
    },
    {
      agent: "Communications_Agent",
      command: "Relayed encrypted handshake to satellite relay. Connection established with 98% signal strength."
    },
    {
      agent: "Analytics_Agent",
      command: "Executed regression on telemetry data. Temperature variance exceeds threshold by 12%."
    }
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
