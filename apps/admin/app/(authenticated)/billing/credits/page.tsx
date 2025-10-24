import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminBillingCredits, issueBillingCredit } from "@/lib/identity";
import type { AdminBillingCreditListResponse } from "@ma/contracts";
import { extractAdminRoles } from "@/lib/roles";
import { getSupabaseServerComponentClient, getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { isAdminBillingEnabled } from "@/lib/feature-flags";

const formatCurrency = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountCents / 100);

export default async function BillingCreditsPage({
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

  const organizationFilter =
    typeof searchParams?.organizationId === "string" && searchParams.organizationId.trim().length > 0
      ? searchParams.organizationId.trim()
      : undefined;

  let credits: AdminBillingCreditListResponse = { credits: [] };
  if (organizationFilter) {
    credits = await getAdminBillingCredits(session.access_token, organizationFilter);
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-xl font-semibold text-foreground">Credit memos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Credits offset invoice charges for refunds, service failures, or negotiated adjustments. Use the form below to
          issue new credits that downstream systems will apply during payment reconciliation.
        </p>
      </section>

      <details className="rounded-lg border border-dashed border-border bg-background/60 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          Issue a new credit memo
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Provide an organization ID, optional invoice reference, and the amount in cents. Credits are recorded
          immediately and emitted to the billing worker for reconciliation.
        </p>
        <form action={issueCreditAction} className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Organization ID</span>
            <input
              required
              name="organizationId"
              placeholder="org_123"
              className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Invoice ID (optional)</span>
            <input
              name="invoiceId"
              placeholder="inv_456"
              className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Amount (cents)</span>
            <input
              required
              name="amountCents"
              type="number"
              min={1}
              className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Currency</span>
            <input
              name="currency"
              defaultValue="usd"
              className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Reason</span>
            <input
              required
              name="reason"
              placeholder="promotion / refund / adjustment"
              className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Metadata (JSON)</span>
            <textarea
              name="metadata"
              placeholder='{"note":"Customer goodwill credit"}'
              className="min-h-[80px] rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Issue credit
            </button>
          </div>
        </form>
      </details>

      <section className="rounded-lg border border-border bg-background p-4 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-semibold text-foreground">Recorded credits</h4>
            <p className="text-sm text-muted-foreground">
              {organizationFilter
                ? `${credits.credits.length} credit memos totaling ${formatCurrency(
                    credits.credits.reduce((total, credit) => total + credit.amountCents, 0),
                    credits.credits[0]?.currency ?? "usd"
                  )}`
                : "Provide an organization ID to review existing credits."}
            </p>
          </div>
          <form className="text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Filter by org</span>
              <input
                name="organizationId"
                defaultValue={organizationFilter ?? ""}
                placeholder="org_123"
                className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Apply
              </button>
            </label>
          </form>
        </header>

        {organizationFilter ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                <th className="px-3 py-2 text-left font-medium">Credit</th>
                <th className="px-3 py-2 text-left font-medium">Organization</th>
                <th className="px-3 py-2 text-left font-medium">Invoice</th>
                <th className="px-3 py-2 text-left font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Reason</th>
                <th className="px-3 py-2 text-left font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {credits.credits.map((credit) => (
                <tr key={credit.id} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-foreground">{credit.id}</div>
                    {credit.expiresAt ? (
                      <div className="text-xs text-muted-foreground">
                        Expires {new Date(credit.expiresAt).toLocaleDateString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{credit.organizationId}</td>
                  <td className="px-3 py-3 text-muted-foreground">{credit.invoiceId ?? "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatCurrency(credit.amountCents, credit.currency)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{credit.reason.toLowerCase()}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <pre className="whitespace-pre-wrap break-words text-xs">
                      {credit.metadata ? JSON.stringify(credit.metadata, null, 2) : "—"}
                    </pre>
                  </td>
                </tr>
              ))}
              {credits.credits.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                    No credits recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-border bg-background/60 px-4 py-6 text-sm text-muted-foreground">
            Enter an organization ID to browse existing credit memos.
          </p>
        )}
      </section>
    </div>
  );
}

const issueCreditAction = async (formData: FormData) => {
  "use server";

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be signed in to issue credits.");
  }

  const roles = extractAdminRoles(session);
  if (!roles.has("super-admin")) {
    throw new Error("Only Super Admins can issue credits.");
  }

  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const invoiceId = String(formData.get("invoiceId") ?? "").trim() || null;
  const amountCents = Number(formData.get("amountCents") ?? 0);
  const currency = String(formData.get("currency") ?? "usd").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const metadataRaw = String(formData.get("metadata") ?? "").trim();

  if (!organizationId || !reason || Number.isNaN(amountCents) || amountCents <= 0) {
    throw new Error("Organization, reason, and a positive amount are required.");
  }

  let metadata: Record<string, unknown> | undefined;
  if (metadataRaw) {
    try {
      const parsed = JSON.parse(metadataRaw);
      if (typeof parsed !== "object" || parsed === null) {
        throw new Error("Metadata must be a JSON object.");
      }
      metadata = parsed;
    } catch (error) {
      throw new Error(`Failed to parse metadata JSON: ${(error as Error).message}`);
    }
  }

  await issueBillingCredit(session.access_token, organizationId, {
    invoiceId,
    amountCents,
    currency,
    reason,
    metadata
  });

  revalidatePath("/billing/credits");
};
