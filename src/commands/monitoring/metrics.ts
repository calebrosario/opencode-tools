// Metrics Command - Phase 2: MVP Core
// Week 17: Monitoring & Metrics Implementation

import { Command } from "commander";
import { dashboard, getFormattedDashboard } from "../../monitoring/dashboard";

export const metricsCommand = new Command("metrics")
  .description("Show system metrics and performance data")
  .option("-j, --json", "Output as JSON")
  .option("-c, --csv", "Output as CSV")
  .action(async (options) => {
    try {
      if (options.json) {
        const jsonData = await dashboard.exportJSON();
        console.log(jsonData);
        return;
      }

      if (options.csv) {
        const csvData = await dashboard.exportCSV();
        console.log(csvData);
        return;
      }

      const formatted = await getFormattedDashboard();

      console.log("\n" + "═".repeat(60));
      console.log("AGENTIC ARMOR - METRICS DASHBOARD");
      console.log("═".repeat(60));

      console.log("\nSUMMARY\n");
      formatted.summary.forEach((line) => console.log(`  ${line}`));

      console.log("\nTASK METRICS\n");
      formatted.tasks.forEach((line) => console.log(line));

      if (formatted.operations.length > 0) {
        console.log("\nOPERATION PERFORMANCE\n");
        formatted.operations.forEach((line) => console.log(line));
      }

      if (formatted.performance.length > 0) {
        console.log("\nPERFORMANCE\n");
        formatted.performance.forEach((line) => console.log(line));
      }

      if (formatted.recommendations.length > 0) {
        console.log("\nRECOMMENDATIONS\n");
        formatted.recommendations.forEach((line) => console.log(`  ${line}`));
      }

      console.log("\n" + "═".repeat(60) + "\n");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[FAIL] Failed to get metrics:", errorMessage);
      process.exit(1);
    }
  });
