import { metrics } from "../../src/monitoring/metrics";

describe("MetricsCollector", () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe("Counter", () => {
    it("should increment counter", () => {
      metrics.increment("test_counter", {}, 5);
      const counters = metrics.getCounters();
      expect(counters.length).toBe(1);
      const firstCounter = counters[0];
      if (firstCounter) {
        expect(firstCounter.value).toBe(5);
      }
    });
  });

  describe("Timer", () => {
    it("should start and stop timer", async () => {
      const timerId = metrics.startTimer("test", {});
      await new Promise((resolve) => setTimeout(resolve, 10));
      const duration = metrics.stopTimer(timerId);
      expect(duration).not.toBeNull();
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe("Gauge", () => {
    it("should set gauge", () => {
      metrics.setGauge("test", 42, {});
      const gauges = metrics.getGauges();
      expect(gauges.length).toBe(1);
      const firstGauge = gauges[0];
      if (firstGauge) {
        expect(firstGauge.value).toBe(42);
      }
    });
  });

  describe("Export", () => {
    it("should export as JSON", () => {
      const json = metrics.exportJSON();
      expect(typeof json).toBe("object");
      const parsed = json as { counters: unknown; gauges: unknown };
      expect(parsed).toHaveProperty("counters");
      expect(parsed).toHaveProperty("gauges");
    });
  });

  describe("Reset", () => {
    it("should clear all metrics", () => {
      metrics.increment("counter1", {}, 1);
      metrics.setGauge("gauge1", 10, {});
      metrics.reset();
      expect(metrics.getCounters().length).toBe(0);
      expect(metrics.getGauges().length).toBe(0);
    });
  });
});
