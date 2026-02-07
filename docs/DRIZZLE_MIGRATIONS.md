# Drizzle ORM Migration Guide

This guide covers setting up and using Drizzle ORM migrations with PostgreSQL for the agent-armor project.

## Overview

Drizzle ORM provides type-safe database queries and migrations for PostgreSQL. This project uses Drizzle to:

- Define database schemas in TypeScript
- Generate SQL migrations automatically
- Apply migrations to PostgreSQL databases
- Maintain type-safe database access

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL database (local or remote)
- Drizzle ORM and drizzle-kit installed

## Configuration

### Files

- `drizzle.config.ts` - Drizzle-kit configuration
- `src/persistence/schema.ts` - Database schema definitions
- `src/persistence/database.ts` - Database connection and client setup
- `migrations/` - Generated migration SQL files

### Environment Variables

Set these in your `.env` file:

```bash
# Production/Staging Database
DATABASE_URL=postgresql://localhost:5432/opencode

# Test Database
DATABASE_URL_TEST=postgresql://localhost:5432/opencode_test
```

## Workflow

### 1. Define Schema Changes

Edit `src/persistence/schema.ts` to modify your database schema:

```typescript
import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  owner: text("owner"),
  metadata: jsonb("metadata"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
```

### 2. Generate Migration

Run the migration generation command:

```bash
npm run db:generate
```

This will:

- Compare your schema against the current database state
- Generate a new SQL migration file in `migrations/`
- Update migration metadata in `migrations/meta/`

Example output:

```
[✓] Your SQL migration file ➜ migrations/0001_add_user_roles.sql 🚀
```

### 3. Review Migration

Review the generated SQL file to ensure it's correct:

```bash
cat migrations/0001_add_user_roles.sql
```

### 4. Apply Migration

Apply the migration to your database:

```bash
npm run db:migrate
```

This will:

- Connect to the database specified in `DATABASE_URL`
- Execute pending migrations in order
- Track applied migrations

### 5. Verify Changes

Connect to your database to verify the changes:

```bash
# Using psql
psql postgresql://localhost:5432/opencode

# Or use Drizzle Studio
npm run db:studio
```

## Available Commands

### `npm run db:generate`

Generate a new migration from schema changes.

```bash
npm run db:generate
```

**Options:**

- `--custom`: Custom migration name
- `--prefix`: Custom prefix (default: timestamp)

**Example with custom name:**

```bash
npx drizzle-kit generate --custom=add_user_roles
```

### `npm run db:migrate`

Apply all pending migrations to the database.

```bash
npm run db:migrate
```

**Options:**

- `--force`: Apply migrations even if warnings exist

### `npm run db:push`

Push schema changes directly to database (bypasses migration generation).

⚠️ **Use with caution**: This should only be used in development, not production.

```bash
npm run db:push
```

**When to use:**

- Rapid prototyping
- Local development only
- When you don't need migration history

**When NOT to use:**

- Production deployments
- Teams requiring migration tracking
- When rollbacks are needed

### `npm run db:studio`

Launch Drizzle Studio, a web UI for viewing and editing your database.

```bash
npm run db:studio
```

This opens a browser-based interface to:

- View all tables and columns
- Browse, edit, and delete records
- Run custom queries
- Visualize table relationships

## Migration File Structure

### Migration SQL

Each migration file contains SQL to apply changes:

```sql
-- migrations/0001_add_user_roles.sql
CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "role" text NOT NULL
);
```

### Metadata

Drizzle tracks migrations with metadata files:

- `migrations/meta/_journal.json` - Migration order and status
- `migrations/meta/0001_snapshot.json` - Schema snapshot for each migration

## Best Practices

### Naming Conventions

- Use descriptive table names (e.g., `tasks`, `user_sessions`, not `t1`, `t2`)
- Use snake_case for column names (e.g., `created_at`, not `createdAt` in SQL)
- Use meaningful migration names with `--custom` flag

### Schema Design

- Use `jsonb` for flexible metadata (PostgreSQL-specific)
- Use `timestamp with time zone` for temporal data
- Add indexes on frequently queried columns
- Define foreign keys explicitly if needed

### Development Workflow

1. Make schema changes in `src/persistence/schema.ts`
2. Run `npm run db:generate` to create migration
3. Review generated SQL
4. Run `npm run db:migrate` to apply
5. Test with `npm run db:studio` or `psql`
6. Commit migration files and schema changes together

### Production Workflow

1. Never use `db:push` in production
2. Always generate migrations with `db:generate`
3. Review migrations in code review
4. Test migrations on staging database first
5. Apply migrations to production with `db:migrate`
6. Keep migration files in version control

### Testing

#### Setup Test Database

Create a separate database for testing:

```bash
psql postgresql://localhost:5432/postgres -c "CREATE DATABASE opencode_test;"
```

#### Configure Test Database

Set `DATABASE_URL_TEST` in `.env.test`:

```bash
DATABASE_URL_TEST=postgresql://localhost:5432/opencode_test
```

#### Run Tests with Test Database

Tests should use the test database connection:

```typescript
const dbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
```

## Troubleshooting

### Migration Already Applied

If you see "migration already applied" errors:

```bash
# Check migration status in _journal.json
cat migrations/meta/_journal.json

# If needed, manually remove from journal (caution: only for development)
```

### Connection Errors

If `db:migrate` fails with connection errors:

```bash
# Check PostgreSQL is running
pg_isready

# Check DATABASE_URL in .env
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL
```

### Schema Mismatch

If generated migration doesn't match expectations:

1. Check `drizzle.config.ts` points to correct schema file
2. Verify `DATABASE_URL` in config matches target database
3. Run `npm run db:generate --force` to regenerate
4. Review `src/persistence/schema.ts` for syntax errors

## Migration History

### From SQLite to PostgreSQL

This project migrated from SQLite (better-sqlite3) to PostgreSQL with Drizzle ORM.

**Key differences:**

| SQLite                  | PostgreSQL                             |
| ----------------------- | -------------------------------------- |
| `INTEGER PRIMARY KEY`   | `text PRIMARY KEY` (or `serial`)       |
| `DATETIME`              | `timestamp with time zone`             |
| `TEXT` for JSON         | `jsonb` for JSON                       |
| No explicit constraints | `CHECK`, `FOREIGN KEY` constraints     |
| SQLite triggers         | PostgreSQL triggers (different syntax) |

**Migration files:**

- Legacy: `migrations/001_initial_schema.sql` (SQLite)
- Backup: `.backup/migrations/001_initial_schema.sql` (preserved)
- Current: `migrations/0000_high_mastermind.sql` (PostgreSQL)

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle Kit Documentation](https://orm.drizzle.team/docs/kit-docs/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Type Safety Guide](https://orm.drizzle.team/docs/good-practices)

## Support

For issues or questions:

1. Check Drizzle documentation first
2. Review existing migrations in `migrations/` directory
3. Test with `npm run db:studio` to verify schema
4. Consult project maintainers if needed
