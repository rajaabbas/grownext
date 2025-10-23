import { redirect } from "next/navigation";
import { getAdminBillingSubscriptions } from "@/lib/identity";
import { extractAdminRoles } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { isAdminBillingEnabled } from "@/lib/feature-flags";

const formatCurrency = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountCents / 100);

const SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INCOMPLETE", "INCOMPLETE_EXPIRED"];

export default async function BillingSubscriptionsPage({
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

  const organizationId =
    typeof searchParams?.organizationId === "string" ? searchParams?.organizationId.trim() : undefined;
  const status =
    typeof searchParams?.status === "string" && SUBSCRIPTION_STATUSES.includes(searchParams.status)
      ? searchParams.status
      : undefined;

  const subscriptions = await getAdminBillingSubscriptions(session.access_token, { organizationId, status });

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-xl font-semibold text-foreground">Subscription explorer</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Search subscriptions across tenants, inspect billing intervals, and identify plans that require attention.
        </p>
      </section>

      <form className="grid gap-3 rounded-lg border border-border bg-background/60 p-4 text-sm md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Organization ID</span>
          <input
            name="organizationId"
            defaultValue={organizationId ?? ""}
            placeholder="Optional filter"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          >
            <option value="">All statuses</option>
            {SUBSCRIPTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Apply filters
          </button>
          <a
            href="/billing/subscriptions"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary"
          >
            Reset
          </a>
        </div>
      </form>

      <section className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Organization</th>
              <th className="px-3 py-2 text-left font-medium">Package</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Billing</th>
              <th className="px-3 py-2 text-left font-medium">Current period</th>
              <th className="px-3 py-2 text-left font-medium">External ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {subscriptions.subscriptions.map((subscription) => (
              <tr key={subscription.id} className="align-top">
                <td className="px-3 py-3">
                  <div className="font-semibold text-foreground">{subscription.organizationId}</div>
                  <div className="text-xs text-muted-foreground">{subscription.id}</div>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  <div className="text-foreground">{subscription.package?.name ?? subscription.packageId}</div>
                  <div className="text-xs">
                    {subscription.package?.slug ?? "unlinked"} · {formatCurrency(subscription.amountCents, subscription.currency)}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                    {subscription.status.toLowerCase()}
                  </span>
                  {subscription.cancelAtPeriodEnd ? (
                    <div className="mt-1 text-xs text-amber-500">Cancel at period end</div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  <div>
                    {intervalLabel(subscription.billingInterval)} ·{" "}
                    {formatCurrency(subscription.amountCents, subscription.currency)}
                  </div>
                  {subscription.trialEndsAt ? (
                    <div className="text-xs">Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}</div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  <div>
                    {new Date(subscription.currentPeriodStart).toLocaleDateString()} →{" "}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </div>
                  {subscription.canceledAt ? (
                    <div className="text-xs text-amber-500">
                      Canceled {new Date(subscription.canceledAt).toLocaleDateString()}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {subscription.externalId ?? <span className="text-xs text-muted-foreground/70">n/a</span>}
                </td>
              </tr>
            ))}
            {subscriptions.subscriptions.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                  No subscriptions found for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const intervalLabel = (interval: string) => interval.toLowerCase();
