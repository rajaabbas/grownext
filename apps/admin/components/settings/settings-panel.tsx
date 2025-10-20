"use client";

import { useState, useTransition } from "react";

import { useTelemetry } from "@/components/providers/telemetry-provider";

interface FeatureFlagsState {
  impersonationEnabled: boolean;
  auditExportsEnabled: boolean;
}

interface SettingsPanelProps {
  initialFlags: FeatureFlagsState;
  observabilityEndpoint?: string;
}

export const SettingsPanel = ({ initialFlags, observabilityEndpoint }: SettingsPanelProps) => {
  const [flags, setFlags] = useState<FeatureFlagsState>(initialFlags);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState(observabilityEndpoint ?? "https://telemetry.grownext.dev/ingest");
  const telemetry = useTelemetry();

  const toggleFlag = (key: keyof FeatureFlagsState) => {
    setFlags((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/super-admin/settings/feature-flags", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(flags)
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error ?? `Update failed (${response.status})`);
          }

          setMessage("Feature flags updated successfully.");
          setError(null);
          telemetry.recordEvent("settings_feature_flags_saved", {
            impersonationEnabled: flags.impersonationEnabled,
            auditExportsEnabled: flags.auditExportsEnabled
          });
        } catch (requestError) {
          setError((requestError as Error).message);
          setMessage(null);
          telemetry.recordEvent("settings_feature_flags_failed", {
            error: (requestError as Error).message,
            impersonationEnabled: flags.impersonationEnabled,
            auditExportsEnabled: flags.auditExportsEnabled
          });
        }
      })();
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Feature flags</h3>
          <p className="text-sm text-muted-foreground">
            Toggle privileged capabilities before rolling them out broadly. Changes are logged for auditing.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {message ? (
            <p
              role="status"
              aria-live="polite"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              {message}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm">
            <div>
              <span className="font-medium text-foreground">Impersonation</span>
              <p className="text-xs text-muted-foreground">Enable session delegation workflows for Super Admins.</p>
            </div>
            <input
              type="checkbox"
              checked={flags.impersonationEnabled}
              onChange={() => toggleFlag("impersonationEnabled")}
              className="h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm">
            <div>
              <span className="font-medium text-foreground">Audit exports</span>
              <p className="text-xs text-muted-foreground">Allow auditors to generate CSV exports from the explorer.</p>
            </div>
            <input
              type="checkbox"
              checked={flags.auditExportsEnabled}
              onChange={() => toggleFlag("auditExportsEnabled")}
              className="h-4 w-4"
            />
          </label>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Observability</h3>
          <p className="text-sm text-muted-foreground">
            Configure where structured telemetry is forwarded. Updates propagate immediately.
          </p>
        </header>
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Endpoint
            <input
              type="url"
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Telemetry currently streams to the configured endpoint via structured JSON over HTTPS. Update the destination above and restart the service to pick up changes.
          </p>
        </div>
      </section>
    </div>
  );
};
