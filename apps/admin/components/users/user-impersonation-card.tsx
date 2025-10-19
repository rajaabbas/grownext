"use client";

import { useEffect, useState, useTransition } from "react";

import { useTelemetry } from "@/components/providers/telemetry-provider";

interface UserImpersonationCardProps {
  userId: string;
}

interface ImpersonationResult {
  tokenId: string;
  url: string;
  expiresAt: string;
}

const DURATION_OPTIONS = [15, 30, 60] as const;

export const UserImpersonationCard = ({ userId }: UserImpersonationCardProps) => {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<number>(15);
  const [result, setResult] = useState<ImpersonationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasCopied, setHasCopied] = useState(false);
  const telemetry = useTelemetry();

  useEffect(() => {
    if (!result) {
      setHasCopied(false);
    }
  }, [result]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/super-admin/users/${userId}/impersonation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              expiresInMinutes: duration,
              reason: reason.trim() || undefined
            })
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error ?? `Request failed (${response.status})`);
          }

          const payload = await response.json();
          setResult({
            tokenId: payload.tokenId as string,
            url: payload.url as string,
            expiresAt: payload.expiresAt as string
          });
          setError(null);
          telemetry.recordEvent("impersonation_session_created", {
            userId,
            expiresInMinutes: duration,
            hasReason: Boolean(reason.trim())
          });
        } catch (requestError) {
          setResult(null);
          setError((requestError as Error).message);
          telemetry.recordEvent("impersonation_session_failed", {
            userId,
            error: (requestError as Error).message
          });
        }
      })();
    });
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setHasCopied(true);
      telemetry.recordEvent("impersonation_link_copied", { userId, tokenId: result.tokenId });
    } catch (copyError) {
      console.error("Failed to copy impersonation URL", copyError);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Impersonation</h3>
        <p className="text-sm text-muted-foreground">
          Generate a time-bound impersonation session to reproduce issues in the user&rsquo;s context. Sessions expire automatically and are recorded in the audit log.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Purpose (optional)
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reference ticket or incident context"
              disabled={isPending}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Duration
            <select
              value={duration}
              onChange={(event) => setDuration(Number.parseInt(event.target.value, 10))}
              disabled={isPending}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} minutes
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Generating…" : "Generate session"}
          </button>
        </div>
      </form>

      {result ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm"
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-primary/80">Session link</span>
            <code className="break-all rounded-md bg-background px-2 py-1 text-xs text-foreground">
              {result.url}
            </code>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
            <span>Expires at: {new Date(result.expiresAt).toLocaleString()}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
              >
                {hasCopied ? "Copied" : "Copy link"}
              </button>
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary underline-offset-4 hover:bg-primary/20"
              >
                Open session
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
