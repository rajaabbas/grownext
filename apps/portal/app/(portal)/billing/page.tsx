import Link from "next/link";
import { getBillingAccessOrThrow } from "@/lib/billing/server";
import { fetchPortalBillingOverview } from "@/lib/identity";
import { BillingPlanManager } from "@/components/billing-plan-manager";
import { BillingContactsEditor } from "@/components/billing-contacts-editor";

const formatCurrency = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountCents / 100);

const formatDate = (value: Date | null | undefined) =>
  value ? value.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

export default async function PortalBillingOverviewPage() {
  const access = await getBillingAccessOrThrow();
  const { overview } = await fetchPortalBillingOverview(access.accessToken);

  const subscription = overview.subscription;
  const plan = overview.activePackage;
  const currency = subscription?.currency ?? plan?.currency ?? "usd";
  const renewalDate = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const outstanding = overview.outstandingBalanceCents;
  const defaultPaymentMethod = overview.paymentMethods.find(
    (method) => method.id === overview.defaultPaymentMethodId
  );
  const warnings = overview.featureWarnings;
  const recentInvoices = overview.recentInvoices.slice(0, 5);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-white">Billing</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Track your subscription, monitor usage, and stay ahead of upcoming invoices. Changes here apply to your entire
          organization.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-white">Plan summary</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Current plan</div>
              <div className="mt-1 text-base font-medium text-slate-100">
                {plan ? plan.name : "No active package"}
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Status: {subscription ? subscription.status.toLowerCase() : "inactive"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Renewal</div>
              <div className="mt-1 text-base font-medium text-slate-100">{formatDate(renewalDate)}</div>
              {subscription ? (
                <div className="mt-1 text-sm text-slate-400">
                  Billed {subscription.billingInterval.toLowerCase()} &middot;{" "}
                  {formatCurrency(subscription.amountCents, currency)}
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-400">Activate a plan to unlock usage-based billing.</div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Outstanding balance</div>
              <div className="mt-1 text-base font-medium text-slate-100">
                {outstanding > 0 ? formatCurrency(outstanding, currency) : "Paid in full"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Scheduled changes</div>
              <div className="mt-1 text-base font-medium text-slate-100">
                {overview.scheduledChanges.length === 0
                  ? "None"
                  : `${overview.scheduledChanges.length} pending change${
                      overview.scheduledChanges.length > 1 ? "s" : ""
                    }`}
              </div>
              {overview.scheduledChanges.length > 0 ? (
                <div className="mt-1 text-sm text-slate-400">
                  First change takes effect {formatDate(new Date(overview.scheduledChanges[0].effectiveAt))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/billing/usage"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-fuchsia-500 hover:text-fuchsia-200"
            >
              View usage details
            </Link>
            <Link
              href="/billing/invoices"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-fuchsia-500 hover:text-fuchsia-200"
            >
              Review invoices
            </Link>
          </div>
        </div>

        <div id="payment-methods" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">Payment method</h2>
          {defaultPaymentMethod ? (
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="font-medium text-slate-100">
                {defaultPaymentMethod.brand?.toUpperCase() ?? "Card"} ending in {defaultPaymentMethod.last4 ?? "••••"}
              </div>
              <div className="text-slate-400">
                Expires {defaultPaymentMethod.expMonth?.toString().padStart(2, "0") ?? "??"}/
                {defaultPaymentMethod.expYear ?? "??"}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
              Add a default payment method to avoid service interruptions when invoices are issued.
            </p>
          )}
          <Link
            href="/billing#payment-methods"
            className="mt-4 inline-flex items-center text-sm text-fuchsia-300 hover:text-fuchsia-200"
          >
            Manage payment methods
          </Link>
        </div>
      </section>

      <section id="plan-management" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Manage plan</h2>
        <p className="mt-2 text-sm text-slate-400">
          Submit upgrades, downgrades, or cancellations. Changes are routed through billing workflows and may take a
          moment to finalize.
        </p>
        <div className="mt-6">
          <BillingPlanManager subscription={subscription} activePackage={plan} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-white">Usage at a glance</h2>
          {overview.usageSummaries.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No usage has been recorded for this period.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead className="bg-slate-900/80 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Feature</th>
                    <th className="px-4 py-3 text-left font-medium">Total</th>
                    <th className="px-4 py-3 text-left font-medium">Period</th>
                    <th className="px-4 py-3 text-left font-medium">Plan limit</th>
                    <th className="px-4 py-3 text-left font-medium">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {overview.usageSummaries.map((summary) => {
                    const percent = summary.percentageUsed ?? null;
                    const utilization =
                      percent === null
                        ? "—"
                        : `${percent.toFixed(1)}% ${percent >= 100 ? "(over limit)" : ""}`;

                    return (
                      <tr key={`${summary.featureKey}-${summary.periodStart}`}>
                        <td className="px-4 py-3 text-slate-100">{summary.featureKey}</td>
                        <td className="px-4 py-3">
                          {summary.totalQuantity} {summary.unit}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(new Date(summary.periodStart))} &ndash;{" "}
                          {formatDate(new Date(summary.periodEnd))}
                        </td>
                        <td className="px-4 py-3">
                          {summary.limitValue
                            ? `${summary.limitValue} ${summary.limitUnit ?? ""}`.trim()
                            : "Unlimited"}
                        </td>
                        <td className="px-4 py-3">{utilization}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div id="contacts" className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">Contacts &amp; tax</h2>
          <p className="mt-2 text-sm text-slate-400">
            Keep billing contacts current so invoices reach the right stakeholders. Tax identifiers are displayed for
            reference and can be updated through support.
          </p>
          <div className="mt-6">
            <BillingContactsEditor contacts={overview.contacts} taxIds={overview.taxIds} />
          </div>
        </div>
      </section>

      {warnings.length > 0 ? (
        <section className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-6">
          <h2 className="text-lg font-semibold text-amber-200">Usage alerts</h2>
          <ul className="mt-3 space-y-3 text-sm text-amber-100">
            {warnings.map((warning) => (
              <li key={`${warning.featureKey}-${warning.status}`} className="flex flex-col gap-1">
                <span className="font-medium">
                  {warning.featureKey}: {warning.status === "exceeded" ? "Limit exceeded" : "Approaching limit"}
                </span>
                <span className="text-amber-200/80">
                  {warning.message} (current {warning.currentPercent}% &middot; threshold {warning.thresholdPercent}%)
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent invoices</h2>
          <Link href="/billing/invoices" className="text-sm text-fuchsia-300 hover:text-fuchsia-200">
            View all
          </Link>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Invoices will appear here as soon as billing runs.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Issued</th>
                  <th className="px-4 py-3 text-left font-medium">Total</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 text-slate-100">{invoice.number}</td>
                    <td className="px-4 py-3">{formatDate(new Date(invoice.issuedAt))}</td>
                    <td className="px-4 py-3">{formatCurrency(invoice.totalCents, invoice.currency)}</td>
                    <td className="px-4 py-3 capitalize">{invoice.status.toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
