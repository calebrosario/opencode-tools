// Health Command - Week 17: Monitoring & Metrics
// Display system health check results

import { Command } from "commander";
import { health } from "../../monitoring/health";
import { HealthStatus } from "../../monitoring/health";

/**
 * Display system health check results
 */
export const healthCommand = new Command("health")
  .description("Display system health status")
  .option("-d, --detailed", "Show detailed health check information")
  .option("-f, --fail-fast", "Exit with error if any check fails")
  .action(async (options) => {
    try {
      const healthData = await health.checkAll();

      console.log("\n" + "═".repeat(60));
      console.log("AGENTIC ARMOR - HEALTH CHECK");
      console.log("═".repeat(60));

      const statusEmoji =
        healthData.overall === "healthy"
          ? "[OK]"
          : healthData.overall === "warning"
            ? "[WARN]"
            : "[FAIL]";
      const statusColor =
        healthData.overall === "healthy"
          ? "\x1b[32m"
          : healthData.overall === "warning"
            ? "\x1b[33m"
            : "\x1b[31m";
      const reset = "\x1b[0m";

      console.log(
        `\n${statusEmoji} Overall Status: ${statusColor}${healthData.overall.toUpperCase()}${reset}`,
      );
      console.log(`  Check Time: ${healthData.timestamp}\n`);

      console.log("Health Checks:\n");
      console.log("  " + "-".repeat(55));

      let hasFailures = false;

      for (const check of healthData.checks) {
        const checkEmoji =
          check.status === "healthy"
            ? "[OK]"
            : check.status === "warning"
              ? "[WARN]"
              : "[FAIL]";

        const checkColor =
          check.status === "healthy"
            ? "\x1b[32m"
            : check.status === "warning"
              ? "\x1b[33m"
              : "\x1b[31m";

        console.log(
          `  ${checkEmoji} ${check.name.padEnd(20)} ${checkColor}${check.status.padEnd(10)}${reset} ${check.durationMs}ms`,
        );

        if (check.message && (options.detailed || check.status !== "healthy")) {
          console.log(`     ${check.message}`);
        }

        if (check.status === "unhealthy") {
          hasFailures = true;
        }

        if (options.detailed && check.details) {
          console.log(
            `     Details: ${JSON.stringify(check.details, null, 2)}`,
          );
        }
      }

      console.log("  " + "-".repeat(55) + "\n");

      const healthyCount = healthData.checks.filter(
        (c) => c.status === "healthy",
      ).length;
      const warningCount = healthData.checks.filter(
        (c) => c.status === "warning",
      ).length;
      const unhealthyCount = healthData.checks.filter(
        (c) => c.status === "unhealthy",
      ).length;

      console.log(
        `Summary: ${healthyCount} healthy, ${warningCount} warnings, ${unhealthyCount} unhealthy\n`,
      );
      console.log("═".repeat(60) + "\n");

      if (options.failFast && hasFailures) {
        console.error("[FAIL] Health check failed");
        process.exit(1);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[FAIL] Failed to run health check:", errorMessage);
      process.exit(1);
    }
  });
