"use client";

import { useLcpMetric } from "@/components/hooks/use-lcp-metric";

export const PerformanceMetricsProvider = () => {
  useLcpMetric();
  return null;
};
