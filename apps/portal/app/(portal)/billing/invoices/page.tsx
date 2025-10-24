import {
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
import { fetchPortalBillingInvoices } from "@/lib/identity";

const formatCurrency = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    amountCents / 100
  );

const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "—";

export default async function PortalBillingInvoicesPage() {
  const access = await getBillingAccessOrThrow();
  const { invoices } = await fetchPortalBillingInvoices(access.accessToken, {
    organizationId: access.launcher.user.organizationId
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Access historical invoices, track payment status, and download records for your accounting workflow.
        </p>
      </header>

      <BillingSurface className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Billing history</h2>
          <p className="text-sm text-muted-foreground">
            The most recent invoices are listed first. Download links arrive as the document pipeline rolls out.
          </p>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Invoices will appear once billing runs for your workspace. Check back after the next cycle.
          </p>
        ) : (
          <BillingTableContainer>
            <BillingTable>
              <BillingTableHead>
                <BillingTableRow>
                  <BillingTableHeaderCell>Invoice</BillingTableHeaderCell>
                  <BillingTableHeaderCell>Issued</BillingTableHeaderCell>
                  <BillingTableHeaderCell>Due</BillingTableHeaderCell>
                  <BillingTableHeaderCell>Total</BillingTableHeaderCell>
                  <BillingTableHeaderCell>Balance</BillingTableHeaderCell>
                  <BillingTableHeaderCell>Status</BillingTableHeaderCell>
                  <BillingTableHeaderCell>Actions</BillingTableHeaderCell>
                </BillingTableRow>
              </BillingTableHead>
              <BillingTableBody>
                {invoices.map((invoice) => (
                  <BillingTableRow key={invoice.id}>
                    <BillingTableCell className="font-semibold text-foreground">{invoice.number}</BillingTableCell>
                    <BillingTableCell>{formatDate(invoice.issuedAt)}</BillingTableCell>
                    <BillingTableCell>{formatDate(invoice.dueAt)}</BillingTableCell>
                    <BillingTableCell>{formatCurrency(invoice.totalCents, invoice.currency)}</BillingTableCell>
                    <BillingTableCell>
                      {invoice.balanceCents > 0
                        ? formatCurrency(invoice.balanceCents, invoice.currency)
                        : "Settled"}
                    </BillingTableCell>
                    <BillingTableCell>
                      <BillingStatusBadge status={invoice.status} />
                    </BillingTableCell>
                    <BillingTableCell>
                      <span className="text-xs text-muted-foreground">Download coming soon</span>
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
