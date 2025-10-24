const parseRetryAfterSeconds = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }

  const dateValue = Date.parse(value);
  if (!Number.isNaN(dateValue)) {
    const seconds = Math.round((dateValue - Date.now()) / 1000);
    if (seconds > 0) {
      return seconds;
    }
  }

  return null;
};

export const formatRateLimitMessage = (action: string, retryAfterHeader: string | null): string => {
  const seconds = parseRetryAfterSeconds(retryAfterHeader);
  const base = `We received too many ${action} requests.`;

  if (seconds === null) {
    return `${base} Try again shortly.`;
  }

  if (seconds >= 60) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `${base} Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }

  const clamped = Math.max(1, seconds);
  return `${base} Try again in about ${clamped} second${clamped === 1 ? "" : "s"}.`;
};
