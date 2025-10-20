"use client";

import { useEffect } from "react";

interface LcpPayload {
  name: string;
  value: number;
  size: number | null;
}

const sendPayload = (payload: LcpPayload) => {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/telemetry/lcp", blob);
    return;
  }

  void fetch("/api/telemetry/lcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {
    // eslint-disable-next-line no-console
    console.warn("Failed to report LCP metric");
  });
};

export const useLcpMetric = () => {
  useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
      return;
    }

    let reported = false;
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (!entries.length) {
        return;
      }

      const entry = entries[entries.length - 1];
      if (reported) {
        return;
      }

      reported = true;
      const payload: LcpPayload = {
        name: entry.name ?? "largest-contentful-paint",
        value: entry.startTime,
        size: typeof (entry as PerformanceEntry & { size?: number }).size === "number"
          ? (entry as PerformanceEntry & { size?: number }).size ?? null
          : null
      };

      sendPayload(payload);
    });

    try {
      observer.observe({ type: "largest-contentful-paint", buffered: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Unable to observe LCP metrics", error);
    }

    return () => {
      observer.disconnect();
    };
  }, []);
};
