import { commitFact } from "@/memory/team";

export async function POST(req: Request) {
  const { agentId, taskId, factKey, factValue } = await req.json();
  await commitFact(agentId, taskId, factKey, factValue);
  return Response.json({ ok: true });
}
