import { pgTable, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";

// Define PostgreSQL enum for task status
// This ensures database-level constraint matching TypeScript TaskStatus union type
export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const);

// Define tasks table for PostgreSQL
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: taskStatusEnum("status").notNull(),
  owner: text("owner"),
  metadata: jsonb("metadata"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// Schema types export
export type TaskInsert = typeof tasks.$inferInsert;
export type TaskSelect = typeof tasks.$inferSelect;
export type TaskUpdate = Partial<typeof tasks.$inferInsert>;
