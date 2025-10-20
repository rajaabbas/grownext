"use client";

import { useMemo } from "react";
import { ArrowTopRightOnSquareIcon, StopCircleIcon } from "@heroicons/react/24/outline";

import { useImpersonationSession } from "@/components/providers/impersonation-session-provider";

const formatRemaining = (secondsRemaining: number | null) => {
  if (secondsRemaining === null) {
    return "unknown";
  }
  if (secondsRemaining <= 0) {
    return "0 seconds";
  }

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  if (minutes <= 0) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }

  if (seconds === 0) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"}`;
};

export const ImpersonationBanner = () => {
  const { session, secondsRemaining, isExpiringSoon, stopError, isStopping, stopSession } =
    useImpersonationSession();

  const bannerTone = isExpiringSoon ? "border-amber-400 bg-amber-50 text-amber-900" : "border-primary/40 bg-primary/10 text-primary-900";

  const targetLabel = useMemo(() => {
    if (!session) return "";
    if (session.userName && session.userName.trim().length > 0) {
      return session.userName;
    }
    return session.userEmail;
  }, [session]);

  if (!session) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-3 border-b ${bannerTone} px-6 py-4 text-sm shadow-sm md:flex-row md:items-center md:justify-between`}
    >
      <div className="space-y-1">
        <p className="font-medium">
          Impersonation session active for <span className="underline decoration-primary/60">{targetLabel}</span>.
        </p>
        <p className="text-xs md:text-sm">
          Expires in {formatRemaining(secondsRemaining)}. Use the dedicated session link and stop when finished to capture an audit entry.
        </p>
        {stopError ? (
          <p className="text-xs text-destructive" role="alert">
            Unable to end session: {stopError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={session.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-white px-3 py-1.5 text-xs font-medium text-primary shadow-sm transition hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
          Open session
        </a>
        <button
          type="button"
          onClick={() => {
            void stopSession("manual");
          }}
          disabled={isStopping}
          className="inline-flex items-center gap-1 rounded-md border border-primary/60 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <StopCircleIcon className="h-4 w-4" aria-hidden="true" />
          {isStopping ? "Stopping…" : "Stop impersonating"}
        </button>
      </div>
    </div>
  );
};
