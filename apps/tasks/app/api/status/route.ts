import { NextResponse } from "next/server";

export async function GET() {
  const redisHealthUrl = process.env.TASKS_REDIS_HEALTH_URL;
  let redisStatus = "unknown";
  let redisLatency: number | null = null;

  if (redisHealthUrl) {
    const start = Date.now();
    try {
      const response = await fetch(redisHealthUrl, { cache: "no-store" });
      redisStatus = response.ok ? "ok" : `error (${response.status})`;
      redisLatency = Date.now() - start;
    } catch (error) {
      redisStatus = (error as Error).message ?? "error";
      redisLatency = null;
    }
  }

  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    services: {
      redis: {
        status: redisStatus,
        latencyMs: redisLatency
      }
    },
    docs: {
      grafana: process.env.TASKS_GRAFANA_DASHBOARD_URL ?? "https://grafana.localhost/d/tasks"
    }
  });
}
