import type { BillingUsageQuery } from "@ma/contracts";
import { getBillingAccessOrThrow } from "@/lib/billing/server";
import { fetchPortalBillingUsage } from "@/lib/identity";

const formatNumber = (value: number | string) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)
    : value;

const normalizeQuery = (
  searchParams?: Record<string, string | string[] | undefined>
): Partial<BillingUsageQuery> => {
  const result: Partial<BillingUsageQuery> = {};
  if (!searchParams) {
    return result;
  }

  const getScalar = (key: string) => {
    const value = searchParams[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value ?? undefined;
  };

  const featureKey = getScalar("featureKey");
  const resolution = getScalar("resolution");
  const from = getScalar("from");
  const to = getScalar("to");
  const tenantId = getScalar("tenantId");
  const productId = getScalar("productId");

  if (featureKey) result.featureKey = featureKey;
  if (resolution) result.resolution = resolution as BillingUsageQuery["resolution"];
  if (from) result.from = from;
  if (to) result.to = to;
  if (tenantId) result.tenantId = tenantId;
  if (productId) result.productId = productId;

  return result;
};

export default async function PortalBillingUsagePage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const access = await getBillingAccessOrThrow();
  const query = normalizeQuery(searchParams);
  const usage = await fetchPortalBillingUsage(access.accessToken, {
    query: Object.keys(query).length > 0 ? query : undefined,
    context: { organizationId: access.launcher.user.organizationId }
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-white">Usage</h1>
        <p className="text-sm text-slate-400">
          Review recorded consumption across features, tenants, and products. Adjust filters with query parameters to
          focus on specific timeframes or workloads.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Filters</h2>
        <dl className="mt-4 grid gap-4 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Feature</dt>
            <dd className="mt-1 text-slate-100">{query.featureKey ?? "All features"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Resolution</dt>
            <dd className="mt-1 text-slate-100">{(query.resolution ?? "DAILY").toLowerCase()}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">From</dt>
            <dd className="mt-1 text-slate-100">{query.from ?? "Beginning of period"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">To</dt>
            <dd className="mt-1 text-slate-100">{query.to ?? "Latest aggregate"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Tenant</dt>
            <dd className="mt-1 text-slate-100">{query.tenantId ?? "All tenants"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Product</dt>
            <dd className="mt-1 text-slate-100">{query.productId ?? "All products"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Summaries</h2>
        {usage.summaries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No usage summaries found for the selected filters.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Feature</th>
                  <th className="px-4 py-3 text-left font-medium">Total</th>
                  <th className="px-4 py-3 text-left font-medium">Unit</th>
                  <th className="px-4 py-3 text-left font-medium">Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {usage.summaries.map((summary) => (
                  <tr key={`${summary.featureKey}-${summary.resolution}`}>
                    <td className="px-4 py-3 text-slate-100">{summary.featureKey}</td>
                    <td className="px-4 py-3">{formatNumber(summary.totalQuantity)}</td>
                    <td className="px-4 py-3">{summary.unit}</td>
                    <td className="px-4 py-3 lowercase">{summary.resolution.toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {usage.series.map((series) => (
        <section key={series.featureKey} className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-white">{series.featureKey}</h2>
            <p className="text-sm text-slate-400">
              {series.points.length} data point{series.points.length === 1 ? "" : "s"} &middot; {series.unit} &middot;{" "}
              {series.resolution.toLowerCase()}
            </p>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Period start</th>
                  <th className="px-4 py-3 text-left font-medium">Period end</th>
                  <th className="px-4 py-3 text-left font-medium">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {series.points.map((point) => (
                  <tr key={point.periodStart}>
                    <td className="px-4 py-3">
                      {new Date(point.periodStart).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(point.periodEnd).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </td>
                    <td className="px-4 py-3">{formatNumber(point.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
