import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { teamFacts, pendingConflicts } from "@/db/schema";

export async function commitFact(
  agentId: string,
  taskId: string,
  factKey: string,
  factValue: unknown
) {
  const existing = await db.query.teamFacts.findFirst({
    where: and(eq(teamFacts.factKey, factKey), eq(teamFacts.status, "active")),
  });
  if (!existing) {
    await db.insert(teamFacts).values({
      factKey,
      factValue,
      committedByAgent: agentId,
      taskId,
    });
    return;
  }
  if (JSON.stringify(existing.factValue) === JSON.stringify(factValue)) return;
  // conflict
  await db.insert(pendingConflicts).values({
    factKey,
    incomingValue: factValue,
    incomingAgent: agentId,
    existingFactId: existing.id,
    taskId,
  });
}

export async function arbitrate(conflictId: string, decision: "accept_incoming" | "keep_existing") {
  const conflict = await db.query.pendingConflicts.findFirst({
    where: eq(pendingConflicts.id, conflictId),
  });
  if (!conflict) throw new Error("Conflict not found");

  if (decision === "accept_incoming") {
    await db
      .update(teamFacts)
      .set({ status: "superseded" })
      .where(eq(teamFacts.id, conflict.existingFactId));
    await db.insert(teamFacts).values({
      factKey: conflict.factKey,
      factValue: conflict.incomingValue,
      committedByAgent: conflict.incomingAgent,
      taskId: conflict.taskId,
    });
  }
  await db
    .update(pendingConflicts)
    .set({ resolution: decision, resolvedAt: new Date() })
    .where(eq(pendingConflicts.id, conflictId));
}
