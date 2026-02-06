const connectionString =
  "postgresql://opencode_test:opencode_test_password@localhost:5432/opencode_test?schema=public";
console.log("Connection string:", connectionString);

const { Pool } = require("pg");
const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

(async () => {
  const client = await pool.connect();
  console.log("Connected!");

  try {
    const result = await client.query("SELECT current_user");
    console.log("Current user:", result.rows[0].current_user);
  } catch (err) {
    console.error("SELECT current_user error:", err.message);
  }

  try {
    await client.query("BEGIN");
    console.log("BEGIN successful");
  } catch (err) {
    console.error("BEGIN error:", err.message);
  }

  try {
    await client.query('TRUNCATE TABLE "tasks" CASCADE');
    console.log("TRUNCATE successful");
  } catch (err) {
    console.error("TRUNCATE error:", err.message);
  }

  client.release();
  await pool.end();
  console.log("Connection closed");
})().catch((err) => {
  console.error("Connection error:", err.message);
  console.error("Error code:", err.code);
  console.error("Full error:", err);
  process.exit(1);
});
