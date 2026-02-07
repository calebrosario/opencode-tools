import { dashboard } from "../../src/monitoring/dashboard";

describe("DashboardProvider", () => {
  describe("Dashboard Data", () => {
    it("should get dashboard data", async () => {
      const data = await dashboard.getDashboardData();
      
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("overall");
      expect(data).toHaveProperty("metrics");
      expect(data).toHaveProperty("health");
      expect(data).toHaveProperty("performance");
    });
  });

  describe("Formatted Dashboard", () => {
    it("should format for display", async () => {
      const formatted = await dashboard.getFormattedDashboard();
      
      expect(formatted).toHaveProperty("summary");
      expect(formatted).toHaveProperty("tasks");
      expect(formatted).toHaveProperty("operations");
      expect(formatted).toHaveProperty("health");
      expect(formatted).toHaveProperty("performance");
      expect(formatted).toHaveProperty("recommendations");
    });
  });

  describe("Export Functions", () => {
    it("should export as JSON", async () => {
      const json = await dashboard.exportJSON();
      
      expect(typeof json).toBe("string");
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty("timestamp");
      expect(parsed).toHaveProperty("metrics");
    });

    it("should export as CSV", async () => {
      const csv = await dashboard.exportCSV();
      
      expect(typeof csv).toBe("string");
      expect(csv).toContain("Metric,Value");
    });
  });
});
