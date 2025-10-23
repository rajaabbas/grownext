import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createBillingPackage, getAdminBillingCatalog } from "@/lib/identity";
import { extractAdminRoles } from "@/lib/roles";
import { getSupabaseServerComponentClient, getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { isAdminBillingEnabled } from "@/lib/feature-flags";
import type { BillingFeatureLimit } from "@ma/contracts";

const formatCurrency = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountCents / 100);

const intervalLabel = (interval: string) => interval.toLowerCase();

const parseFeatureLimits = (input: string): BillingFeatureLimit[] => {
  if (!input.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) {
      throw new Error("Feature limits must be an array");
    }
    return parsed as BillingFeatureLimit[];
  } catch (error) {
    throw new Error(
      `Failed to parse feature limits JSON: ${(error as Error).message}. Expected an array of feature limit definitions.`
    );
  }
};

export default async function BillingCatalogPage() {
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

  const catalog = await getAdminBillingCatalog(session.access_token);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">Package catalog</h3>
        <p className="text-sm text-muted-foreground">
          Packages describe billable plans that appear in the portal and drive subscription pricing. Create new entries
          when launching tiers or adjusting AI usage thresholds. Feature limits are stored as structured metadata and
          interpreted by the portal + worker during usage aggregation.
        </p>
      </section>

      <CreatePackageForm />

      <section className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Package</th>
              <th className="px-3 py-2 text-left font-medium">Pricing</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Feature limits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground">
            {catalog.packages.map((pkg) => (
              <tr key={pkg.id} className="align-top">
                <td className="px-3 py-3">
                  <div className="font-semibold text-foreground">{pkg.name}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{pkg.slug}</div>
                  {pkg.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{pkg.description}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <div>{formatCurrency(pkg.amountCents, pkg.currency)}</div>
                  <div className="text-xs text-muted-foreground">
                    Billed {intervalLabel(pkg.interval)}
                    {pkg.trialPeriodDays ? ` · ${pkg.trialPeriodDays} day trial` : ""}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                      pkg.active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {pkg.active ? "active" : "inactive"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {pkg.featureLimits.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No feature limits defined.</p>
                  ) : (
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      {pkg.featureLimits.map((limit) => (
                        <li key={`${pkg.id}-${limit.featureKey}`}>
                          <span className="font-medium text-foreground">{limit.featureKey}</span> ·{" "}
                          {limit.limitType.toLowerCase()}
                          {limit.limitValue !== null ? ` · ${limit.limitValue} ${limit.limitUnit ?? ""}` : ""}
                          {limit.usagePeriod ? ` · ${limit.usagePeriod.toLowerCase()}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const CreatePackageForm = () => {
  return (
    <details className="rounded-lg border border-dashed border-border bg-background/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Create a new package
      </summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Provide slug, plan metadata, and optional feature limits. Feature limits should be an array of objects that
        match the billing schema (featureKey, limitType, limitValue, limitUnit, usagePeriod).
      </p>
      <form action={createPackageAction} className="mt-4 grid gap-4 text-sm text-foreground md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Slug</span>
          <input
            required
            name="slug"
            placeholder="tasks_starter"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Name</span>
          <input
            required
            name="name"
            placeholder="Starter"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Description</span>
          <textarea
            name="description"
            placeholder="Optional description shown in the portal catalog."
            className="min-h-[60px] rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Currency</span>
          <input
            required
            name="currency"
            defaultValue="usd"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Amount (cents)</span>
          <input
            required
            name="amountCents"
            type="number"
            min={0}
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Interval</span>
          <select
            name="interval"
            defaultValue="MONTHLY"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          >
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Trial period (days)</span>
          <input
            name="trialPeriodDays"
            type="number"
            min={0}
            placeholder="0"
            className="rounded-md border border-border bg-background px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Feature limits (JSON)</span>
          <textarea
            name="featureLimits"
            placeholder='[{"featureKey":"ai.tokens","limitType":"SOFT","limitValue":200000,"limitUnit":"tokens","usagePeriod":"MONTHLY"}]'
            className="min-h-[120px] rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Create package
          </button>
        </div>
      </form>
    </details>
  );
};

const createPackageAction = async (formData: FormData) => {
  "use server";

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be signed in to create packages.");
  }

  const roles = extractAdminRoles(session);
  if (!roles.has("super-admin")) {
    throw new Error("Only Super Admins can manage billing packages.");
  }

  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const currency = String(formData.get("currency") ?? "usd").trim();
  const amountCents = Number(formData.get("amountCents") ?? 0);
  const interval = String(formData.get("interval") ?? "MONTHLY");
  const trialPeriodRaw = formData.get("trialPeriodDays");
  const featureLimitInput = String(formData.get("featureLimits") ?? "");

  if (!slug || !name) {
    throw new Error("Slug and name are required.");
  }

  if (Number.isNaN(amountCents) || amountCents < 0) {
    throw new Error("Amount must be a non-negative number of cents.");
  }

  const trialPeriodDays =
    typeof trialPeriodRaw === "string" && trialPeriodRaw.length > 0 ? Number(trialPeriodRaw) : null;

  if (trialPeriodDays !== null && (Number.isNaN(trialPeriodDays) || trialPeriodDays < 0)) {
    throw new Error("Trial period must be a non-negative number of days.");
  }

  const featureLimits = parseFeatureLimits(featureLimitInput);

  await createBillingPackage(session.access_token, {
    slug,
    name,
    description,
    currency,
    amountCents,
    interval: interval as "MONTHLY" | "YEARLY",
    trialPeriodDays,
    featureLimits
  });

  revalidatePath("/billing/catalog");
};
