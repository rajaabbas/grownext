interface TelemetryPayload {
  event: string;
  metadata?: Record<string, unknown>;
  level?: "info" | "warn" | "error";
  timestamp?: string;
}

const emit = (payload: TelemetryPayload) => {
  const entry = {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString()
  };

  const message = `[telemetry] ${entry.event}`;

  switch (entry.level) {
    case "error":
      console.error(message, entry.metadata ?? {});
      break;
    case "warn":
      console.warn(message, entry.metadata ?? {});
      break;
    default:
      console.info(message, entry.metadata ?? {});
  }
};

export const recordEvent = (event: string, metadata?: Record<string, unknown>) => {
  emit({ event, metadata, level: "info" });
};

export const recordWarning = (event: string, metadata?: Record<string, unknown>) => {
  emit({ event, metadata, level: "warn" });
};

export const recordError = (event: string, metadata?: Record<string, unknown>) => {
  emit({ event, metadata, level: "error" });
};
