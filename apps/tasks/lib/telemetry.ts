"use client";

interface MetricPayload {
  event: string;
  data: Record<string, unknown>;
}

const sendBeacon = (payload: MetricPayload) => {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/telemetry/metrics", blob);
    return;
  }

  void fetch("/api/telemetry/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {
    // eslint-disable-next-line no-console
    console.warn("Failed to record telemetry metric", payload);
  });
};

export const recordAssignmentMetric = (durationMs: number, queueDepth: number) => {
  sendBeacon({
    event: "task_assignment_latency",
    data: {
      durationMs,
      queueDepth,
      recordedAt: new Date().toISOString()
    }
  });
};
