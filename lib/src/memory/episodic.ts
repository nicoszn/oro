import { and, eq, cosineDistance } from "drizzle-orm";
import { db } from "@/db";
import { episodicMemories } from "@/lib/src/db/schema";
import { hashEmbed } from "@/lib/src/embeddings/hash";

export async function recall(agentId: string, taskType: string, query: string, k = 5) {
  const queryVec = hashEmbed(query);
  return db
    .select({ id: episodicMemories.id, content: episodicMemories.content })
    .from(episodicMemories)
    .where(and(eq(episodicMemories.agentId, agentId), eq(episodicMemories.taskType, taskType)))
    .orderBy(cosineDistance(episodicMemories.embedding, queryVec))
    .limit(k);
}

export async function record(agentId: string, taskType: string, summary: string, outcome: string) {
  const content = `${summary}\n\nOutcome: ${outcome}`;
  await db.insert(episodicMemories).values({
    agentId,
    taskType,
    content,
    embedding: hashEmbed(content),
  });
}
