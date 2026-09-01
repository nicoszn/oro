import { buildGraph } from "@/lib/src/graph";

export const maxDuration = 300; // 5 min (Hobby) – set to 800 on Pro

export async function POST(req: Request) {
  const { taskType, input } = await req.json();
  const taskId = crypto.randomUUID();
  const graph = buildGraph();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      req.signal.addEventListener("abort", () => controller.close());
      try {
        for await (const event of graph.streamEvents(
          {
            messages: [{ role: "user", content: input }],
            taskId,
            taskType,
          },
          {
            configurable: { thread_id: taskId, taskType },
            version: "v2",
          }
        )) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
