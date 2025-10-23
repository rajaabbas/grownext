import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BillingStatusBadge,
  BillingSurface,
  BillingTable,
  BillingTableBody,
  BillingTableCell,
  BillingTableHead,
  BillingTableHeaderCell,
  BillingTableRow
} from "@ma/ui";
import { getAdminBillingInvoices, updateBillingInvoiceStatus } from "@/lib/identity";
import { extractAdminRoles } from "@/lib/roles";
import { getSupabaseServerComponentClient, getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { isAdminBillingEnabled } from "@/lib/feature-flags";

const formatCurrency = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountCents / 100);

const INVOICE_STATUSES = ["DRAFT", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"] as const;
const INVOICE_STATUS_SET = new Set<string>(INVOICE_STATUSES);

const isInvoiceStatus = (value: string): value is (typeof INVOICE_STATUSES)[number] =>
  INVOICE_STATUS_SET.has(value);

export default async function BillingInvoicesPage({
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
    typeof searchParams?.organizationId === "string" ? searchParams.organizationId.trim() : undefined;
  const status =
    typeof searchParams?.status === "string" && isInvoiceStatus(searchParams.status)
      ? searchParams.status
      : undefined;

  const invoices = await getAdminBillingInvoices(session.access_token, { organizationId, status });

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-xl font-semibold text-foreground">Invoice review</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor invoice state, confirm successful payments, and mark refunds or voids with structured audit context.
        </p>
      </section>

      <BillingSurface variant="muted" padded={false}>
        <form className="grid gap-3 p-4 text-sm md:grid-cols-3">
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
              {INVOICE_STATUSES.map((value) => (
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
              href="/billing/invoices"
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary"
            >
              Reset
            </a>
          </div>
        </form>
      </BillingSurface>

      <BillingSurface padded={false}>
        <div className="overflow-x-auto p-4">
          <BillingTable className="min-w-full text-sm">
            <BillingTableHead>
              <BillingTableRow>
                <BillingTableHeaderCell>Invoice</BillingTableHeaderCell>
                <BillingTableHeaderCell>Organization</BillingTableHeaderCell>
                <BillingTableHeaderCell>Status</BillingTableHeaderCell>
                <BillingTableHeaderCell>Dates</BillingTableHeaderCell>
                <BillingTableHeaderCell>Totals</BillingTableHeaderCell>
                <BillingTableHeaderCell>Actions</BillingTableHeaderCell>
              </BillingTableRow>
            </BillingTableHead>
            <BillingTableBody>
              {invoices.invoices.map((invoice) => (
                <BillingTableRow key={invoice.id} className="align-top">
                  <BillingTableCell className="align-top">
                    <div className="font-semibold text-foreground">{invoice.number}</div>
                    <div className="text-xs text-muted-foreground">{invoice.id}</div>
                    {invoice.subscriptionId ? (
                      <div className="text-xs text-muted-foreground">Subscription: {invoice.subscriptionId}</div>
                    ) : null}
                  </BillingTableCell>
                  <BillingTableCell className="align-top text-muted-foreground">
                    <div>{invoice.organizationId}</div>
                    {invoice.externalId ? <div className="text-xs">Provider ID: {invoice.externalId}</div> : null}
                  </BillingTableCell>
                  <BillingTableCell className="align-top">
                    <BillingStatusBadge status={invoice.status} className="uppercase" />
                  </BillingTableCell>
                  <BillingTableCell className="align-top text-muted-foreground">
                    <div>Issued {new Date(invoice.issuedAt).toLocaleDateString()}</div>
                    {invoice.dueAt ? <div>Due {new Date(invoice.dueAt).toLocaleDateString()}</div> : null}
                    {invoice.paidAt ? (
                      <div className="text-xs text-emerald-500">Paid {new Date(invoice.paidAt).toLocaleString()}</div>
                    ) : null}
                    {invoice.voidedAt ? (
                      <div className="text-xs text-amber-500">Voided {new Date(invoice.voidedAt).toLocaleString()}</div>
                    ) : null}
                  </BillingTableCell>
                  <BillingTableCell className="align-top text-muted-foreground">
                    <div>{formatCurrency(invoice.totalCents, invoice.currency)}</div>
                    <div className="text-xs text-muted-foreground/80">
                      Balance {formatCurrency(invoice.balanceCents, invoice.currency)}
                    </div>
                  </BillingTableCell>
                  <BillingTableCell className="align-top">
                    <div className="flex flex-wrap gap-2">
                      {invoice.status !== "PAID" ? (
                        <form action={updateInvoiceStatusAction} className="inline">
                          <input type="hidden" name="invoiceId" value={invoice.id} />
                          <input type="hidden" name="status" value="PAID" />
                          <button
                            type="submit"
                            className="rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20"
                          >
                            Mark paid
                          </button>
                        </form>
                      ) : null}
                      {invoice.status !== "VOID" ? (
                        <form action={updateInvoiceStatusAction} className="inline">
                          <input type="hidden" name="invoiceId" value={invoice.id} />
                          <input type="hidden" name="status" value="VOID" />
                          <button
                            type="submit"
                            className="rounded-md bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 transition hover:bg-amber-500/20"
                          >
                            Void
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </BillingTableCell>
                </BillingTableRow>
              ))}
              {invoices.invoices.length === 0 ? (
                <BillingTableRow>
                  <BillingTableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No invoices found for the selected filters.
                  </BillingTableCell>
                </BillingTableRow>
              ) : null}
            </BillingTableBody>
          </BillingTable>
        </div>
      </BillingSurface>
    </div>
  );
}

const updateInvoiceStatusAction = async (formData: FormData) => {
  "use server";

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be signed in to update invoices.");
  }

  const roles = extractAdminRoles(session);
  if (!roles.has("super-admin")) {
    throw new Error("Only Super Admins can update invoices.");
  }

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim().toUpperCase();

  if (!invoiceId || !isInvoiceStatus(status)) {
    throw new Error("Invalid invoice update request.");
  }

  const updatePayload: Parameters<typeof updateBillingInvoiceStatus>[2] = {
    status,
    balanceCents: 0
  };

  const now = new Date().toISOString();
  if (status === "PAID") {
    updatePayload.paidAt = now;
  }
  if (status === "VOID") {
    updatePayload.voidedAt = now;
  }

  await updateBillingInvoiceStatus(session.access_token, invoiceId, updatePayload);
  revalidatePath("/billing/invoices");
};
