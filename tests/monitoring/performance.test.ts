import { performance } from "../../src/monitoring/performance";

describe("PerformanceTracker", () => {
  beforeEach(() => {
    performance.clearHistory();
  });

  describe("Performance Snapshots", () => {
    it("should create snapshot", async () => {
      performance.takeSnapshot();
      const snapshot = await performance.getLatestSnapshot();

      expect(snapshot).toBeDefined();
      if (snapshot) {
        expect(snapshot).toHaveProperty("timestamp");
        expect(snapshot).toHaveProperty("cpu");
        expect(snapshot).toHaveProperty("memory");
      }
    });
  });

  describe("Performance Averages", () => {
    beforeEach(async () => {
      for (let i = 0; i < 10; i++) {
        performance.takeSnapshot();
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    });

    it("should calculate averages", () => {
      const averages = performance.getAverages();

      expect(averages).toBeDefined();
      expect(averages?.cpu).toBeGreaterThan(0);
      expect(averages?.memory).toBeGreaterThan(0);
    });
  });

  describe("History Management", () => {
    it("should clear history", () => {
      performance.clearHistory();

      const history = (performance as any).getHistory();
      expect(history.length).toBe(0);
    });
  });
});
