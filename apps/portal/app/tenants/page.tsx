import { redirect } from "next/navigation";
import { CreateTenantForm } from "@/components/create-tenant-form";
import { EnableProductForm } from "@/components/enable-product-form";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchOrganizationProducts, fetchPortalLauncher } from "@/lib/identity";

export default async function TenantsPage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  let launcherData;
  try {
    launcherData = await fetchPortalLauncher(session.access_token);
  } catch (error) {
    console.error("Failed to load tenant data", error);
    redirect("/login");
  }
  const tenants = launcherData.tenants;
  const organizationId = launcherData.user.organizationId;

  let organizationProducts: Awaited<ReturnType<typeof fetchOrganizationProducts>> | null = null;
  try {
    organizationProducts = await fetchOrganizationProducts(session.access_token, organizationId);
  } catch (error) {
    console.error("Failed to load organization products", error);
  }

  const productOptions =
    organizationProducts?.products.map((product) => ({
      id: product.id,
      name: product.name
    })) ?? [];

  const entitlementsByTenant = new Map<string, Set<string>>();
  if (organizationProducts) {
    for (const entitlement of organizationProducts.entitlements) {
      const existing = entitlementsByTenant.get(entitlement.tenantId) ?? new Set<string>();
      existing.add(entitlement.productId);
      entitlementsByTenant.set(entitlement.tenantId, existing);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Tenant Management</h1>
        <p className="text-slate-400">
          Provision new environments, invite collaborators, and align entitlements across tenants.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {tenants.map((tenant) => (
          <div key={tenant.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{tenant.name}</h2>
                <p className="text-sm text-slate-500">Slug: {tenant.slug ?? "n/a"}</p>
              </div>
              <button className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-fuchsia-500 hover:text-fuchsia-200">
                View activity
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-400">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Members</dt>
                <dd className="text-base text-slate-200">{tenant.membersCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Products</dt>
                <dd className="text-base text-slate-200">{tenant.productsCount}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-start gap-2 text-sm">
              <button className="rounded-md border border-slate-700 px-3 py-1 text-slate-300 hover:border-fuchsia-500 hover:text-fuchsia-200">
                Invite member
              </button>
              <EnableProductForm
                tenantId={tenant.id}
                organizationId={organizationId}
                productOptions={productOptions}
                assignedProductIds={Array.from(entitlementsByTenant.get(tenant.id) ?? [])}
              />
            </div>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6">
        <h2 className="text-lg font-semibold text-white">Create a new tenant</h2>
        <p className="mt-1 text-sm text-slate-400">
          Tenant provisioning calls the identity admin APIs and seeds entitlements through the worker
          queue.
        </p>
        <CreateTenantForm organizationId={organizationId} />
      </section>
    </div>
  );
}
