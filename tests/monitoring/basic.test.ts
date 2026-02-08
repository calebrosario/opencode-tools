import { metrics } from "../../src/monitoring/metrics";
import { health } from "../../src/monitoring/health";
import { performance } from "../../src/monitoring/performance";
import { dashboard } from "../../src/monitoring/dashboard";

describe("Monitoring System - Basic Tests", () => {
  beforeEach(() => {
    metrics.reset();
  });

  it("should increment counter metric", () => {
    metrics.increment("test_counter", {}, 1);
    const counters = metrics.getCounters();
    expect(counters.length).toBe(1);
    const firstCounter = counters[0];
    if (firstCounter) {
      expect(firstCounter.value).toBe(1);
    }
  });

  it("should set gauge metric", () => {
    metrics.setGauge("test_gauge", 42, {});
    const gauges = metrics.getGauges();
    expect(gauges.length).toBe(1);
    const firstGauge = gauges[0];
    if (firstGauge) {
      expect(firstGauge.value).toBe(42);
    }
  });

  it("should start and stop timer", async () => {
    const timerId = metrics.startTimer("test_timer", {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    const duration = metrics.stopTimer(timerId);
    expect(duration).not.toBeNull();
    expect(duration).toBeGreaterThanOrEqual(10);
  });

  it("should run health checks", async () => {
    const healthData = await health.checkAll();
    expect(healthData).toHaveProperty("overall");
    expect(healthData).toHaveProperty("checks");
    expect(healthData.checks.length).toBeGreaterThan(0);
  });

  it("should create performance snapshot", async () => {
    const snapshot = await performance.getLatestSnapshot();
    expect(snapshot).toBeDefined();
    if (snapshot) {
      expect(snapshot).toHaveProperty("cpu");
      expect(snapshot).toHaveProperty("memory");
      expect(snapshot.cpu.usagePercent).toBeGreaterThanOrEqual(0);
    }
  });

  it("should get dashboard data", async () => {
    const data = await dashboard.getDashboardData();
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("overall");
    expect(data).toHaveProperty("metrics");
  });
});
