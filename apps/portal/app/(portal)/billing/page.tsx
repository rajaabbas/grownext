import Link from "next/link";
import {
  BillingMetric,
  BillingStatusBadge,
  BillingSurface,
  BillingTable,
  BillingTableBody,
  BillingTableCell,
  BillingTableContainer,
  BillingTableHead,
  BillingTableHeaderCell,
  BillingTableRow
} from "@ma/ui";
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
  const { accessToken } = await getBillingAccessOrThrow();
  const { overview } = await fetchPortalBillingOverview(accessToken);

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
        <h1 className="text-3xl font-semibold text-foreground">Billing</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Track your subscription, monitor usage, and stay ahead of upcoming invoices. Changes here apply to your entire
          organization.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <BillingSurface className="lg:col-span-2 space-y-6">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Plan summary</h2>
            <p className="text-sm text-muted-foreground">
              Review your active package, renewal cadence, and any scheduled changes before they take effect.
            </p>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            <BillingMetric
              label="Current plan"
              value={plan ? plan.name : "No active package"}
              helper={
                subscription ? (
                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    <BillingStatusBadge status={subscription.status} />
                    <span>
                      {subscription.billingInterval.toLowerCase()} ·{" "}
                      {formatCurrency(subscription.amountCents, currency)}
                    </span>
                  </span>
                ) : (
                  "Activate a plan to unlock usage-based billing."
                )
              }
            />
            <BillingMetric
              label="Renewal"
              value={formatDate(renewalDate)}
              helper={
                subscription
                  ? `Renews automatically via ${subscription.billingInterval.toLowerCase()} invoices.`
                  : undefined
              }
            />
            <BillingMetric
              label="Outstanding balance"
              value={outstanding > 0 ? formatCurrency(outstanding, currency) : "Paid in full"}
              helper={
                outstanding > 0
                  ? "Settle the balance to avoid service disruption before the next billing cycle."
                  : undefined
              }
            />
            <BillingMetric
              label="Scheduled changes"
              value={
                overview.scheduledChanges.length === 0
                  ? "None"
                  : `${overview.scheduledChanges.length} pending change${
                      overview.scheduledChanges.length > 1 ? "s" : ""
                    }`
              }
              helper={
                overview.scheduledChanges.length > 0
                  ? `First change effective ${formatDate(new Date(overview.scheduledChanges[0].effectiveAt))}.`
                  : undefined
              }
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/billing/usage"
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/60 hover:text-primary"
            >
              View usage details
            </Link>
            <Link
              href="/billing/invoices"
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/60 hover:text-primary"
            >
              Review invoices
            </Link>
          </div>
        </BillingSurface>

        <BillingSurface id="payment-methods" variant="muted" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Payment method</h2>
          {defaultPaymentMethod ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="text-base font-semibold text-foreground">
                {defaultPaymentMethod.brand?.toUpperCase() ?? "Card"} ending in {defaultPaymentMethod.last4 ?? "••••"}
              </div>
              <div>
                Expires {defaultPaymentMethod.expMonth?.toString().padStart(2, "0") ?? "??"}/
                {defaultPaymentMethod.expYear ?? "??"}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add a default payment method to avoid service interruptions when invoices are issued.
            </p>
          )}
          <Link
            href="/billing#payment-methods"
            className="inline-flex items-center text-sm font-semibold text-primary transition hover:text-primary/80"
          >
            Manage payment methods
          </Link>
        </BillingSurface>
      </section>

      <BillingSurface id="plan-management" className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Manage plan</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Submit upgrades, downgrades, or cancellations. Changes are routed through billing workflows and may take a
            moment to finalize.
          </p>
        </div>
        <BillingPlanManager subscription={subscription} activePackage={plan} />
      </BillingSurface>

      <section className="grid gap-6 lg:grid-cols-3">
        <BillingSurface className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Usage at a glance</h2>
          {overview.usageSummaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage has been recorded for this period.</p>
          ) : (
            <BillingTableContainer className="mt-2">
              <BillingTable>
                <BillingTableHead>
                  <BillingTableRow>
                    <BillingTableHeaderCell>Feature</BillingTableHeaderCell>
                    <BillingTableHeaderCell>Total</BillingTableHeaderCell>
                    <BillingTableHeaderCell>Period</BillingTableHeaderCell>
                    <BillingTableHeaderCell>Plan limit</BillingTableHeaderCell>
                    <BillingTableHeaderCell>Utilization</BillingTableHeaderCell>
                  </BillingTableRow>
                </BillingTableHead>
                <BillingTableBody>
                  {overview.usageSummaries.map((summary) => {
                    const percent = summary.percentageUsed ?? null;
                    const utilization =
                      percent === null
                        ? "—"
                        : `${percent.toFixed(1)}% ${percent >= 100 ? "(over limit)" : ""}`;

                    return (
                      <BillingTableRow key={`${summary.featureKey}-${summary.periodStart}`}>
                        <BillingTableCell className="font-semibold text-foreground">
                          {summary.featureKey}
                        </BillingTableCell>
                        <BillingTableCell>
                          {summary.totalQuantity} {summary.unit}
                        </BillingTableCell>
                        <BillingTableCell>
                          {formatDate(new Date(summary.periodStart))} &ndash;{" "}
                          {formatDate(new Date(summary.periodEnd))}
                        </BillingTableCell>
                        <BillingTableCell>
                          {summary.limitValue
                            ? `${summary.limitValue} ${summary.limitUnit ?? ""}`.trim()
                            : "Unlimited"}
                        </BillingTableCell>
                        <BillingTableCell>{utilization}</BillingTableCell>
                      </BillingTableRow>
                    );
                  })}
                </BillingTableBody>
              </BillingTable>
            </BillingTableContainer>
          )}
        </BillingSurface>

        <BillingSurface id="contacts" variant="muted" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Contacts &amp; tax</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep billing contacts current so invoices reach the right stakeholders. Tax identifiers are displayed for
              reference and can be updated through support.
            </p>
          </div>
          <BillingContactsEditor contacts={overview.contacts} taxIds={overview.taxIds} />
        </BillingSurface>
      </section>

      {warnings.length > 0 ? (
        <BillingSurface
          variant="muted"
          className="space-y-4 border-amber-500/40 bg-amber-500/10 text-amber-100"
        >
          <div>
            <h2 className="text-lg font-semibold text-amber-100">Usage alerts</h2>
            <p className="text-sm text-amber-200/80">
              Monitor feature limits to stay ahead of throttles and overage charges.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {warnings.map((warning) => (
              <li key={`${warning.featureKey}-${warning.status}`} className="space-y-1">
                <span className="font-semibold text-amber-50">
                  {warning.featureKey}: {warning.status === "exceeded" ? "Limit exceeded" : "Approaching limit"}
                </span>
                <span className="block text-amber-200/90">
                  {warning.message} (current {warning.currentPercent}% · threshold {warning.thresholdPercent}%)
                </span>
              </li>
            ))}
          </ul>
        </BillingSurface>
      ) : null}

      <BillingSurface className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recent invoices</h2>
            <p className="text-sm text-muted-foreground">Keep tabs on the latest issued invoices and payment states.</p>
          </div>
          <Link
            href="/billing/invoices"
            className="text-sm font-semibold text-primary transition hover:text-primary/80"
          >
            View all
          </Link>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Invoices will appear once billing runs for this organization.</p>
        ) : (
          <BillingTableContainer>
            <BillingTable>
              <BillingTableHead>
                <BillingTableRow>
                  <BillingTableHeaderCell>Invoice</BillingTableHeaderCell>
                  <BillingTableHeaderCell>Issued</BillingTableHeaderCell>
                  <BillingTableHeaderCell>Total</BillingTableHeaderCell>
                  <BillingTableHeaderCell>Status</BillingTableHeaderCell>
                </BillingTableRow>
              </BillingTableHead>
              <BillingTableBody>
                {recentInvoices.map((invoice) => (
                  <BillingTableRow key={invoice.id}>
                    <BillingTableCell className="font-semibold text-foreground">{invoice.number}</BillingTableCell>
                    <BillingTableCell>{formatDate(new Date(invoice.issuedAt))}</BillingTableCell>
                    <BillingTableCell>{formatCurrency(invoice.totalCents, invoice.currency)}</BillingTableCell>
                    <BillingTableCell>
                      <BillingStatusBadge status={invoice.status} />
                    </BillingTableCell>
                  </BillingTableRow>
                ))}
              </BillingTableBody>
            </BillingTable>
          </BillingTableContainer>
        )}
      </BillingSurface>
    </div>
  );
}

