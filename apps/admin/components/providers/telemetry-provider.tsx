"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";

import { recordEvent as baseRecordEvent } from "@/lib/telemetry";

interface TelemetryContextValue {
  recordEvent: (event: string, metadata?: Record<string, unknown>) => void;
}

const TelemetryContext = createContext<TelemetryContextValue>({ recordEvent: baseRecordEvent });

export const TelemetryProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo(() => ({ recordEvent: baseRecordEvent }), []);
  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

export const useTelemetry = () => useContext(TelemetryContext);
