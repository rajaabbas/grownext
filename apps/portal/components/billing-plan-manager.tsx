"use client";

import { useState, useTransition } from "react";
import type { BillingSubscription, BillingPackage } from "@ma/contracts";
import { formatRateLimitMessage } from "@/lib/rate-limit";

interface BillingPlanManagerProps {
  subscription: BillingSubscription | null;
  activePackage: BillingPackage | null;
}

const PLAN_TIMINGS: Array<{ value: "immediate" | "period_end" | "scheduled"; label: string }> = [
  { value: "immediate", label: "Immediately" },
  { value: "period_end", label: "At period end" },
  { value: "scheduled", label: "On a specific date" }
];

export function BillingPlanManager({ subscription, activePackage }: BillingPlanManagerProps) {
  const [targetPackageId, setTargetPackageId] = useState(activePackage?.id ?? "");
  const [timing, setTiming] = useState<"immediate" | "period_end" | "scheduled">("period_end");
  const [effectiveAt, setEffectiveAt] = useState("");
  const [reason, setReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChangePlan = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const payload: Record<string, unknown> = {
          packageId: targetPackageId.trim(),
          timing
        };

        if (timing === "scheduled" && effectiveAt) {
          payload.effectiveAt = new Date(effectiveAt).toISOString();
        }

        if (reason.trim().length > 0) {
          payload.reason = reason.trim();
        }

        const response = await fetch("/api/billing/subscription/change", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-requested-with": "XMLHttpRequest"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          let detail: string | null = null;
          try {
            const json = await response.json();
            detail = (json?.message as string | undefined) ?? (json?.error as string | undefined) ?? null;
          } catch {
            detail = null;
          }

          if (response.status === 429) {
            throw new Error(formatRateLimitMessage("plan change", response.headers.get("retry-after")));
          }

          throw new Error(detail ?? `Plan change failed (${response.status})`);
        }

        setMessage("Subscription change requested successfully.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to change subscription");
      }
    });
  };

  const handleCancelPlan = (cancelAtPeriodEnd: boolean) => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/subscription/cancel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-requested-with": "XMLHttpRequest"
          },
          body: JSON.stringify({
            cancelAtPeriodEnd,
            reason: cancelReason.trim().length > 0 ? cancelReason.trim() : undefined
          })
        });

        if (!response.ok) {
          let detail: string | null = null;
          try {
            const json = await response.json();
            detail = (json?.message as string | undefined) ?? (json?.error as string | undefined) ?? null;
          } catch {
            detail = null;
          }

          if (response.status === 429) {
            throw new Error(formatRateLimitMessage("cancellation", response.headers.get("retry-after")));
          }

          throw new Error(detail ?? `Cancellation failed (${response.status})`);
        }

        setMessage(cancelAtPeriodEnd ? "Cancellation scheduled at period end." : "Subscription canceled immediately.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to cancel subscription");
      }
    });
  };

  const disableActions = isPending || targetPackageId.trim().length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="text-sm font-semibold text-white">Change plan</h3>
        <p className="mt-1 text-xs text-slate-400">
          Provide the target package identifier to request an upgrade or downgrade. Changes are subject to availability
          and may require approval.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
            Target package ID
            <input
              value={targetPackageId}
              onChange={(event) => setTargetPackageId(event.target.value)}
              placeholder="pkg_pro_plus"
              className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
            Timing
            <select
              value={timing}
              onChange={(event) => setTiming(event.target.value as typeof timing)}
              className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            >
              {PLAN_TIMINGS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {timing === "scheduled" ? (
            <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
              Effective date
              <input
                type="datetime-local"
                value={effectiveAt}
                onChange={(event) => setEffectiveAt(event.target.value)}
                className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
              />
            </label>
          ) : null}
          <label className="md:col-span-2 flex flex-col text-xs uppercase tracking-wide text-slate-500">
            Reason (optional)
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
              placeholder="Let us know why you are changing plans..."
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleChangePlan}
          disabled={disableActions}
          className="mt-4 inline-flex items-center rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-50"
        >
          {isPending ? "Submitting..." : "Request plan change"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="text-sm font-semibold text-white">Cancel subscription</h3>
        <p className="mt-1 text-xs text-slate-400">
          {subscription
            ? "You can cancel at the end of the current period or immediately. Immediate cancellation will terminate access right away."
            : "No active subscription is currently associated with this workspace."}
        </p>
        <label className="mt-3 flex flex-col text-xs uppercase tracking-wide text-slate-500">
          Reason (optional)
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            rows={2}
            className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="Tell us why you are cancelling..."
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleCancelPlan(true)}
            disabled={isPending || !subscription}
            className="rounded-lg border border-amber-500/50 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-400 hover:text-amber-100 disabled:opacity-50"
          >
            {isPending ? "Submitting..." : "Cancel at period end"}
          </button>
          <button
            type="button"
            onClick={() => handleCancelPlan(false)}
            disabled={isPending || !subscription}
            className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:text-red-100 disabled:opacity-50"
          >
            {isPending ? "Submitting..." : "Cancel immediately"}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{error}</div> : null}
    </div>
  );
}
