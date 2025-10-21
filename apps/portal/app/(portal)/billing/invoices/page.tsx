import { getBillingAccessOrThrow } from "@/lib/billing/server";
import { fetchPortalBillingInvoices } from "@/lib/identity";

const formatCurrency = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    amountCents / 100
  );

const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";

const statusBadgeClasses = (status: string) => {
  switch (status) {
    case "PAID":
      return "rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200";
    case "OPEN":
    case "DRAFT":
      return "rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-200";
    case "UNCOLLECTIBLE":
      return "rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200";
    case "VOID":
      return "rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-200";
    default:
      return "rounded-full bg-slate-500/20 px-3 py-1 text-xs font-semibold text-slate-200";
  }
};

export default async function PortalBillingInvoicesPage() {
  const access = await getBillingAccessOrThrow();
  const { invoices } = await fetchPortalBillingInvoices(access.accessToken);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-white">Invoices</h1>
        <p className="text-sm text-slate-400">
          Access historical invoices, track payment status, and download records for your accounting workflow.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-400">Invoices will appear once billing runs for your workspace.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Issued</th>
                  <th className="px-4 py-3 text-left font-medium">Due</th>
                  <th className="px-4 py-3 text-left font-medium">Total</th>
                  <th className="px-4 py-3 text-left font-medium">Balance</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 text-slate-100">{invoice.number}</td>
                    <td className="px-4 py-3">{formatDate(invoice.issuedAt)}</td>
                    <td className="px-4 py-3">{formatDate(invoice.dueAt)}</td>
                    <td className="px-4 py-3">{formatCurrency(invoice.totalCents, invoice.currency)}</td>
                    <td className="px-4 py-3">
                      {invoice.balanceCents > 0
                        ? formatCurrency(invoice.balanceCents, invoice.currency)
                        : "Settled"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadgeClasses(invoice.status)}>{invoice.status.toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">Download coming soon</span>
                    </td>
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
