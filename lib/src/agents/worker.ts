import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { llm } from "@/graph";
import { webSearchTool } from "@/tools/web-search";
import { writeFileTool, runTestsTool } from "@/tools/sandbox";
import { MemoryRouter } from "@/memory/router";

export async function workerNode(state: any) {
  const { taskId, taskType, plan, messages } = state;
  const router = new MemoryRouter({
    agentId: "worker",
    taskId,
    taskType: plan.taskType,
  });

  // Provide tools based on task type
  const tools = [];
  if (plan.taskType === "research") {
    tools.push(webSearchTool);
  } else if (plan.taskType === "code-gen") {
    tools.push(writeFileTool(taskId), runTestsTool(taskId));
  }

  // Build a prompt that includes the plan and any previous attempts (if revision)
  const prompt = `You are the Worker agent. You have the following plan: ${JSON.stringify(plan)}.
You have access to tools: ${tools.map(t => t.name).join(", ")}.
The user request: ${state.messages[0].content}

Previous context (if any):
${messages.slice(1).map(m => `${m.role}: ${m.content}`).join("\n")}

Proceed step by step. After each step, describe what you did and the result.
If you need to read from episodic memory, use the router (but that is optional).
At the end, provide a final output that fulfills the expected outcome.

Your response must be a single JSON object with:
- "steps": array of {step: string, result: string}
- "finalOutput": string
- "summary": string (a brief summary for episodic memory)`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const result = JSON.parse(response.content as string);

  // Record episode
  await router.writeEpisodic(result.summary, result.finalOutput);

  return {
    ...state,
    workerResult: result,
    messages: [...messages, new AIMessage(`Worker completed: ${result.finalOutput}`)],
  };
}
