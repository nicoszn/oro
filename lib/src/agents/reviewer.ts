import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { llm } from "@/lib/src/graph";
import { MemoryRouter } from "@/lib/src/memory/router";

export async function reviewerNode(state: any) {
  const { taskId, taskType, plan, workerResult, messages } = state;
  const router = new MemoryRouter({
    agentId: "reviewer",
    taskId,
    taskType: plan.taskType,
  });

  const prompt = `You are the Reviewer agent. You must evaluate the Worker's output against the plan and the original user request.

User request: ${state.messages[0].content}
Plan: ${JSON.stringify(plan)}
Worker result: ${JSON.stringify(workerResult)}

Check:
1. Did the Worker follow the plan?
2. Does the finalOutput meet the expected outcome?
3. Is there any missing step or error?

Also, check if the Worker committed any team facts that conflict. (You can ignore conflicts for now; we handle them separately.)

Output a JSON object with:
- "accepted": boolean (true if the work is satisfactory)
- "feedback": string (if not accepted, what needs improvement)
- "revisionNeeded": boolean (if accepted is false)

Respond only with the JSON.`;

  const response = await llm.invoke([new HumanMessage(prompt)]);
  const review = JSON.parse(response.content as string);

  // If not accepted, we will loop back to worker with the feedback
  return {
    ...state,
    revisionNeeded: review.revisionNeeded,
    reviewFeedback: review.feedback,
    messages: [...messages, new AIMessage(`Review: ${review.feedback}`)],
  };
}
