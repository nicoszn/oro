import { StateGraph, MessagesAnnotation, MemorySaver } from "@langchain/langgraph";
import { ChatOpenRouter } from "@langchain/openrouter";
import { plannerNode } from "@/lib/src/agents/planner";
import { workerNode } from "@/lib/src/agents/worker";
import { reviewerNode } from "@/lib/src/agents/reviewer";

export const llm = new ChatOpenRouter({
  model: process.env.OPENROUTER_MODEL!,
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function buildGraph() {
  const checkpointer = new MemorySaver();
  return new StateGraph(MessagesAnnotation)
    .addNode("planner", plannerNode)
    .addNode("worker", workerNode)
    .addNode("reviewer", reviewerNode)
    .addEdge("__start__", "planner")
    .addEdge("planner", "worker")
    .addConditionalEdges("reviewer", (state) => {
      // If reviewer decides revision is needed, go back to worker
      return state.revisionNeeded ? "worker" : "__end__";
    })
    .compile({ checkpointer });
}
