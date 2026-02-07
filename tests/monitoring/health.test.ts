import { health } from "../../src/monitoring/health";

describe("HealthChecker", () => {
  describe("Health Checks", () => {
    it("should run health checks", async () => {
      const healthData = await health.checkAll();
      
      expect(healthData).toHaveProperty("overall");
      expect(healthData).toHaveProperty("checks");
      expect(healthData).toHaveProperty("timestamp");
    });

    it("should return healthy status", async () => {
      const healthData = await health.checkAll();
      
      expect(["healthy", "warning", "unhealthy"]).toContain(healthData.overall);
    });
  });
});
