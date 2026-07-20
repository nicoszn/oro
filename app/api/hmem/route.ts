import { runSimulation } from '@/lib/hmem';
import type { EngineEvent } from '@/lib/hmem';

// Prevent any static optimization/caching of this route — every request
// must re-run the live simulation and stream fresh.
export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: EngineEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await runSimulation(send);
      } catch (error) {
        send({
          type: 'error',
          timestamp: Date.now(),
          message: error instanceof Error ? error.message : String(error)
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
