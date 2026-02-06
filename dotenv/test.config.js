// Jest configuration to load .env.test for test environment
import { config } from "dotenv";

const testEnv = config({ path: ".env.test" });

export default {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/dotenv/preset.cjs"],
  testMatch: ["**/tests/**/*.[jt]s?(x)"],
};
