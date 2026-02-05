import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

// Define tasks table for PostgreSQL
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  owner: text("owner"),
  metadata: jsonb("metadata"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// Schema types export
export type TaskInsert = typeof tasks.$inferInsert;
export type TaskSelect = typeof tasks.$inferSelect;
export type TaskUpdate = typeof tasks.$inferSet;
