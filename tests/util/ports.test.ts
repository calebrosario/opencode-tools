import { describe, test, expect } from "@jest/globals";
import { getAvailablePort, getAvailablePorts } from "./ports";
import net from "net";

describe("getAvailablePort", () => {
  test("finds an available port starting from default", async () => {
    const port = await getAvailablePort();
    expect(port).toBeGreaterThanOrEqual(3000);
    expect(port).toBeLessThanOrEqual(65535);
  });

  test("finds an available port starting from specified port", async () => {
    const startPort = 4000;
    const port = await getAvailablePort(startPort);
    expect(port).toBeGreaterThanOrEqual(startPort);
  });

  test("returns a port that can be bound", async () => {
    const port = await getAvailablePort();
    const server = net.createServer();

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", () => {
        server.close(() => resolve());
      });
      server.listen(port);
    });
  });

  test("respects max attempts parameter", async () => {
    const maxAttempts = 3;
    const port = await getAvailablePort(3000, maxAttempts);
    expect(port).toBeGreaterThanOrEqual(3000);
    expect(port).toBeLessThan(3000 + maxAttempts + 1);
  });

  test("returns different ports on concurrent calls", async () => {
    const [port1, port2, port3] = await Promise.all([
      getAvailablePort(7000),
      getAvailablePort(7000),
      getAvailablePort(7000),
    ]);
    const ports = [port1, port2, port3];
    const uniquePorts = new Set(ports);
    expect(uniquePorts.size).toBe(ports.length);
  });
});

describe("getAvailablePorts", () => {
  test("returns requested number of ports", async () => {
    const ports = await getAvailablePorts(3, 8000);
    expect(ports).toHaveLength(3);
  });

  test("returns unique ports", async () => {
    const ports = await getAvailablePorts(5, 8100);
    const uniquePorts = new Set(ports);
    expect(uniquePorts.size).toBe(ports.length);
  });

  test("returns ports in ascending order", async () => {
    const ports = await getAvailablePorts(4, 8200);
    for (let i = 1; i < ports.length; i++) {
      expect(ports[i]).toBeGreaterThan(ports[i - 1]);
    }
  });

  test("returns ports starting from specified port", async () => {
    const startPort = 8300;
    const ports = await getAvailablePorts(2, startPort);
    expect(ports[0]).toBeGreaterThanOrEqual(startPort);
  });
});
