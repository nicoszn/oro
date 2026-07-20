export * from './types';
export { Tier1Scratchpad, Tier2IndexCache, Tier3SemanticGraph } from './tiers';
export { MemoryRouter } from './memoryRouter';
export { Orchestrator } from './orchestrator';
export { LocalJSONStore } from './localStore';

import { Tier1Scratchpad, Tier2IndexCache, Tier3SemanticGraph } from './tiers';
import { Orchestrator } from './orchestrator';
import { LocalJSONStore } from './localStore';
import { SEED_CORPUS } from './corpus';
import type { EmitFn } from './types';

export async function runSimulation(onEvent?: EmitFn) {
  const store = new LocalJSONStore();
  const t1 = new Tier1Scratchpad();
  const t2 = new Tier2IndexCache();
  const t3 = new Tier3SemanticGraph();

  onEvent?.({
    type: 'simulation_start',
    timestamp: Date.now(),
    message: 'Simulation started'
  });

  const persistedCodebooks = store.loadCodebooks();
  if (persistedCodebooks) {
    t2.hydrateCodebooks(persistedCodebooks);
  } else {
    await t2.trainCodebooks(SEED_CORPUS);
  }
  t2.hydrateVectors(store.loadT2Vectors());

  const persistedGraph = store.loadGraph();
  t3.hydrate(persistedGraph.nodes, persistedGraph.edges);

  const orchestrator = new Orchestrator(t1, t2, t3);

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
    await orchestrator.executeAgentTurn(step.agent, step.command, onEvent);
  }

  if (!persistedCodebooks) {
    store.saveCodebooks(t2.exportCodebooks());
  }
  store.saveT2Vectors(t2.exportVectors());
  const graphState = t3.exportState();
  store.saveGraph(graphState.nodes, graphState.edges);
  store.close();

  const result = {
    logs: orchestrator.logs,
    graphSnapshot: orchestrator.getGraphSnapshot(),
    finalTokenCount: orchestrator.getTokenCount(),
    codebooksTrained: t2.isCodebookTrained()
  };

  onEvent?.({
    type: 'simulation_complete',
    timestamp: Date.now(),
    message: 'Simulation complete',
    data: result
  });

  return result;
}
