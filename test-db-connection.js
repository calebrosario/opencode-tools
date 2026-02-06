// Simple database connection test
import { Pool } from "pg";

async function testConnection() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://opencode_test:opencode_test_password@localhost:5432/opencode_test";

  console.log(
    "Testing connection to:",
    connectionString.replace(/:.*@/, ":****@"),
  );

  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  try {
    const client = await pool.connect();
    console.log("✅ Connected to database!");

    // Test CREATE TABLE
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "tasks" (
          "id" text PRIMARY KEY,
          "name" text NOT NULL,
          "status" text NOT NULL,
          "owner" text,
          "metadata" jsonb,
          "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
          "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
        );
      `);
      console.log("✅ CREATE TABLE successful");
    } catch (err) {
      console.log("❌ CREATE TABLE failed:", err.message);
      console.log("Error code:", err.code);
      console.log("Full error:", err);
    }

    // Test TRUNCATE
    try {
      await client.query('TRUNCATE TABLE "tasks" CASCADE');
      console.log("✅ TRUNCATE successful");
    } catch (err) {
      console.log("❌ TRUNCATE failed:", err.message);
      console.log("Error code:", err.code);
    }

    // Test BEGIN
    try {
      await client.query("BEGIN");
      console.log("✅ BEGIN transaction successful");
      await client.query("ROLLBACK");
      console.log("✅ ROLLBACK successful");
    } catch (err) {
      console.log("❌ Transaction failed:", err.message);
      console.log("Error code:", err.code);
    }

    await client.release();
    console.log("✅ Connection released");
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
    console.error("Error code:", err.code);
    console.error("Full error:", err);
  } finally {
    await pool.end();
    console.log("✅ Pool closed");
  }
}

testConnection().catch(console.error);
