-- Migration: Initial schema for PostgreSQL integration
-- Created: Week 17, Day 2-3
-- Description: Create tasks table with Drizzle ORM schema

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "status" text NOT NULL,
  "owner" text,
  "metadata" jsonb,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
);
