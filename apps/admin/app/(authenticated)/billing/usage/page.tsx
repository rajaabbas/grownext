import { redirect } from "next/navigation";
import { getAdminBillingUsage } from "@/lib/identity";
import { extractAdminRoles } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { isAdminBillingEnabled } from "@/lib/feature-flags";

const RESOLUTIONS = ["HOURLY", "DAILY", "WEEKLY", "MONTHLY"];

export default async function BillingUsagePage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!isAdminBillingEnabled()) {
    redirect("/");
  }

  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/signin");
  }

  const roles = extractAdminRoles(session);
  if (!roles.has("super-admin")) {
    redirect("/");
  }

  const params: Record<string, string> = {};
  if (typeof searchParams?.organizationId === "string") params.organizationId = searchParams.organizationId.trim();
  if (typeof searchParams?.featureKey === "string") params.featureKey = searchParams.featureKey.trim();
  if (typeof searchParams?.tenantId === "string") params.tenantId = searchParams.tenantId.trim();
  if (typeof searchParams?.productId === "string") params.productId = searchParams.productId.trim();
  if (typeof searchParams?.resolution === "string" && RESOLUTIONS.includes(searchParams.resolution)) {
    params.resolution = searchParams.resolution;
  }
  if (typeof searchParams?.from === "string") params.from = searchParams.from.trim();
  if (typeof searchParams?.to === "string") params.to = searchParams.to.trim();

  const usage = await getAdminBillingUsage(session.access_token, params);

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-xl font-semibold text-foreground">Usage analytics</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Query normalized usage records emitted by product apps and workers. Use these aggregates to confirm billing
          instrumentation coverage before enabling external tenants.
        </p>
      </section>

      <form className="grid gap-3 rounded-lg border border-border bg-background/60 p-4 text-sm md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Organization ID</span>
          <input
            name="organizationId"
            defaultValue={params.organizationId ?? ""}
            placeholder="Optional filter"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Feature key</span>
          <input
            name="featureKey"
            defaultValue={params.featureKey ?? ""}
            placeholder="e.g. ai.tokens"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Resolution</span>
          <select
            name="resolution"
            defaultValue={params.resolution ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          >
            <option value="">All</option>
            {RESOLUTIONS.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Tenant ID</span>
          <input
            name="tenantId"
            defaultValue={params.tenantId ?? ""}
            placeholder="Optional"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Product ID</span>
          <input
            name="productId"
            defaultValue={params.productId ?? ""}
            placeholder="Optional"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">From</span>
            <input
              type="datetime-local"
              name="from"
              defaultValue={params.from ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">To</span>
            <input
              type="datetime-local"
              name="to"
              defaultValue={params.to ?? ""}
              className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
        </div>
        <div className="flex items-end gap-3 md:col-span-3">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Apply filters
          </button>
          <a
            href="/billing/usage"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary"
          >
            Reset
          </a>
        </div>
      </form>

      <section className="rounded-lg border border-border bg-background p-4 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-semibold text-foreground">Usage summaries</h4>
            <p className="text-sm text-muted-foreground">Aggregate consumption totals for the current query.</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {usage.summaries.length} summary rows · {usage.series.length} series
          </span>
        </header>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-left font-medium">Resolution</th>
                <th className="px-3 py-2 text-left font-medium">Total quantity</th>
                <th className="px-3 py-2 text-left font-medium">Limit</th>
                <th className="px-3 py-2 text-left font-medium">Utilization</th>
                <th className="px-3 py-2 text-left font-medium">Window</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {usage.summaries.map((summary) => (
                <tr key={`${summary.featureKey}-${summary.resolution}`}>
                  <td className="px-3 py-2 font-medium">{summary.featureKey}</td>
                  <td className="px-3 py-2 text-muted-foreground">{summary.resolution.toLowerCase()}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {summary.totalQuantity} {summary.unit}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {summary.limitValue
                      ? `${summary.limitValue} ${summary.limitUnit ?? ""}`.trim()
                      : summary.limitType?.toLowerCase() ?? "n/a"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {summary.percentageUsed !== null ? `${summary.percentageUsed.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(summary.periodStart).toLocaleDateString()} →{" "}
                    {new Date(summary.periodEnd).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {usage.summaries.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                    No usage summaries found. Adjust filters or run backfills.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h4 className="text-base font-semibold text-foreground">Time series detail</h4>
        {usage.series.map((series) => (
          <article key={series.featureKey} className="rounded-lg border border-border bg-background p-4 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">{series.featureKey}</span> ·{" "}
                {series.resolution.toLowerCase()} · {series.unit}
              </div>
              <div>{series.points.length} points</div>
            </header>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-xs">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Start</th>
                    <th className="px-2 py-1 text-left font-medium">End</th>
                    <th className="px-2 py-1 text-left font-medium">Quantity</th>
                    <th className="px-2 py-1 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {series.points.slice(0, 50).map((point) => (
                    <tr key={point.periodStart}>
                      <td className="px-2 py-1">{new Date(point.periodStart).toLocaleString()}</td>
                      <td className="px-2 py-1">{new Date(point.periodEnd).toLocaleString()}</td>
                      <td className="px-2 py-1">{point.quantity}</td>
                      <td className="px-2 py-1 text-muted-foreground">{point.source.toLowerCase()}</td>
                    </tr>
                  ))}
                  {series.points.length === 0 ? (
                    <tr>
                      <td className="px-2 py-4 text-center text-muted-foreground" colSpan={4}>
                        No data points recorded.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        ))}
        {usage.series.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            No time series data returned. Narrow the timeframe or verify emitters are reporting usage events.
          </div>
        ) : null}
      </section>
    </div>
  );
}
