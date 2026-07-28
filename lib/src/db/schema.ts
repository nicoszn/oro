import {
  pgTable, uuid, text, timestamp, jsonb, real, boolean, vector, index
} from "drizzle-orm/pg-core";

export const teamFacts = pgTable("team_facts", {
  id: uuid("id").defaultRandom().primaryKey(),
  factKey: text("fact_key").notNull(),
  factValue: jsonb("fact_value").notNull(),
  committedByAgent: text("committed_by_agent").notNull(),
  taskId: uuid("task_id").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pendingConflicts = pgTable("pending_conflicts", {
  id: uuid("id").defaultRandom().primaryKey(),
  factKey: text("fact_key").notNull(),
  incomingValue: jsonb("incoming_value").notNull(),
  incomingAgent: text("incoming_agent").notNull(),
  existingFactId: uuid("existing_fact_id").notNull(),
  taskId: uuid("task_id").notNull(),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const episodicMemories = pgTable("episodic_memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: text("agent_id").notNull(),
  taskType: text("task_type").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 256 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("episodic_agent_task_idx").on(t.agentId, t.taskType)]);

export const memoryEvents = pgTable("memory_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull(),
  agentId: text("agent_id").notNull(),
  tier: text("tier").notNull(),
  operation: text("operation").notNull(),
  latencyMs: real("latency_ms").notNull(),
  hit: boolean("hit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const toolEvents = pgTable("tool_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull(),
  agentId: text("agent_id").notNull(),
  toolName: text("tool_name").notNull(),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  latencyMs: real("latency_ms").notNull(),
  success: boolean("success").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const llmCalls = pgTable("llm_calls", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull(),
  agentId: text("agent_id").notNull(),
  requestedModel: text("requested_model").notNull(),
  actualModel: text("actual_model"),
  tokensIn: real("tokens_in"),
  tokensOut: real("tokens_out"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
