"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useTelemetry } from "@/components/providers/telemetry-provider";

export default function AuthenticatedError({ error, reset }: { error: Error; reset: () => void }) {
  const telemetry = useTelemetry();

  useEffect(() => {
    telemetry.recordEvent("authenticated_route_error", {
      message: error.message
    });
  }, [error, telemetry]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center gap-6 px-6 text-sm">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t load this view. The issue has been recorded for the platform team.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
          {error.message}
        </pre>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            href="/docs/plan"
            className="text-xs font-medium text-primary underline underline-offset-4"
          >
            View runbooks
          </Link>
        </div>
      </div>
    </div>
  );
}
