import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { llm } from "@/lib/src/graph";

export async function plannerNode(state: any) {
  const userMessage = state.messages[state.messages.length - 1];
  const prompt = `You are the Planner agent. Given the user request, produce a concise step‑by‑step plan for a Worker agent to follow.

User request: ${userMessage.content}

Output a JSON object with fields:
- "plan": array of steps (each step is a string)
- "expectedOutcome": what the final result should be
- "taskType": either "research" or "code-gen"

Respond only with the JSON.`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const plan = JSON.parse(response.content as string);

  // Store plan in state for later nodes
  return {
    ...state,
    plan,
    messages: [...state.messages, new AIMessage(`Plan ready: ${JSON.stringify(plan)}`)],
  };
}
