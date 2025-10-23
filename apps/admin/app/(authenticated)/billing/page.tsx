import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getAdminBillingCatalog,
  getAdminBillingSubscriptions,
  getAdminBillingInvoices,
  getAdminBillingUsage,
  getAdminBillingCredits
} from "@/lib/identity";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { extractAdminRoles } from "@/lib/roles";
import { isAdminBillingEnabled } from "@/lib/feature-flags";

const formatCurrency = (amountCents: number, currency: string) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  });
  return formatter.format(amountCents / 100);
};

const safeFetch = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (error) {
    console.error("Admin billing overview fetch failed", error);
    return null;
  }
};

export default async function BillingOverviewPage() {
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

  const accessToken = session.access_token;

  const [catalog, subscriptions, invoices, usage, credits] = await Promise.all([
    safeFetch(() => getAdminBillingCatalog(accessToken)),
    safeFetch(() => getAdminBillingSubscriptions(accessToken)),
    safeFetch(() => getAdminBillingInvoices(accessToken)),
    safeFetch(() => getAdminBillingUsage(accessToken)),
    safeFetch(() => getAdminBillingCredits(accessToken))
  ]);

  const totalPackages = catalog?.packages.length ?? 0;
  const activeSubscriptions =
    subscriptions?.subscriptions.filter((subscription) => subscription.status === "ACTIVE").length ?? 0;
  const pastDueSubscriptions =
    subscriptions?.subscriptions.filter((subscription) => subscription.status === "PAST_DUE").length ?? 0;

  const openInvoices =
    invoices?.invoices.filter((invoice) => ["OPEN", "UNCOLLECTIBLE"].includes(invoice.status)) ?? [];
  const totalOutstanding = openInvoices.reduce((total, invoice) => total + invoice.balanceCents, 0);
  const invoiceCurrency = openInvoices[0]?.currency ?? "usd";

  const usageSummaries = usage?.summaries.slice(0, 5) ?? [];
  const creditTotal = credits?.credits.reduce((total, credit) => total + credit.amountCents, 0) ?? 0;
  const creditCurrency = credits?.credits[0]?.currency ?? "usd";

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <header className="text-sm font-medium text-muted-foreground">Active packages</header>
          <p className="mt-2 text-2xl font-semibold text-foreground">{totalPackages}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Includes every catalog entry available to portal tenants.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <header className="text-sm font-medium text-muted-foreground">Active subscriptions</header>
          <p className="mt-2 text-2xl font-semibold text-foreground">{activeSubscriptions}</p>
          <p className="mt-1 text-xs text-muted-foreground">{pastDueSubscriptions} past due</p>
        </article>
        <article className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <header className="text-sm font-medium text-muted-foreground">Outstanding balance</header>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrency(totalOutstanding, invoiceCurrency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{openInvoices.length} invoices awaiting settlement</p>
        </article>
        <article className="rounded-xl border border-border bg-background p-4 shadow-sm">
          <header className="text-sm font-medium text-muted-foreground">Credits issued</header>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrency(creditTotal, creditCurrency)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Total across {credits?.credits.length ?? 0} credit memos.
          </p>
        </article>
      </section>

      <section className="rounded-lg border border-border bg-background p-4 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Recent invoices</h3>
            <p className="text-sm text-muted-foreground">Snapshot of the latest billing documents.</p>
          </div>
          <Link href="/billing/invoices" className="text-xs font-medium text-primary underline">
            View all invoices
          </Link>
        </header>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Invoice</th>
                <th className="px-3 py-2 text-left font-medium">Organization</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Issued</th>
                <th className="px-3 py-2 text-left font-medium">Total</th>
                <th className="px-3 py-2 text-left font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {(invoices?.invoices ?? []).slice(0, 6).map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-3 py-2 font-medium">{invoice.number}</td>
                  <td className="px-3 py-2 text-muted-foreground">{invoice.organizationId}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      {invoice.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(invoice.issuedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{formatCurrency(invoice.totalCents, invoice.currency)}</td>
                  <td className="px-3 py-2">{formatCurrency(invoice.balanceCents, invoice.currency)}</td>
                </tr>
              ))}
              {(invoices?.invoices ?? []).length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                    No invoices available yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-4 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Top usage summaries</h3>
            <p className="text-sm text-muted-foreground">
              Aggregated counts for the most active features across all tenants.
            </p>
          </div>
          <Link href="/billing/usage" className="text-xs font-medium text-primary underline">
            Explore usage
          </Link>
        </header>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-left font-medium">Resolution</th>
                <th className="px-3 py-2 text-left font-medium">Total</th>
                <th className="px-3 py-2 text-left font-medium">Plan limit</th>
                <th className="px-3 py-2 text-left font-medium">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {usageSummaries.map((summary) => (
                <tr key={`${summary.featureKey}-${summary.resolution}`}>
                  <td className="px-3 py-2 font-medium">{summary.featureKey}</td>
                  <td className="px-3 py-2">{summary.resolution.toLowerCase()}</td>
                  <td className="px-3 py-2">{summary.totalQuantity}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {summary.limitValue
                      ? `${summary.limitValue} ${summary.limitUnit ?? ""}`.trim()
                      : "Unlimited"}
                  </td>
                  <td className="px-3 py-2">
                    {summary.percentageUsed !== null ? `${summary.percentageUsed.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
              {usageSummaries.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                    No usage data recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background/50 p-4 shadow-sm">
        <h3 className="text-base font-semibold text-foreground">Next steps</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Review the <Link href="/billing/catalog" className="text-primary underline">package catalog</Link> to ensure plan
            metadata is accurate before enabling external tenants.
          </li>
          <li>
            Use the <Link href="/billing/subscriptions" className="text-primary underline">subscription explorer</Link> to
            confirm pilot customers are provisioned and in the correct state.
          </li>
          <li>
            Monitor <Link href="/billing/usage" className="text-primary underline">usage aggregates</Link> to verify
            production emitters are reporting expected consumption values.
          </li>
        </ul>
      </section>
    </div>
  );
}
