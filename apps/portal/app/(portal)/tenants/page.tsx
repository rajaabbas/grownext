import { redirect } from "next/navigation";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher } from "@/lib/identity";
import { hasPortalPermission, resolvePortalPermissions } from "@/lib/portal-permissions";
import { AddTenantDialog } from "@/components/add-tenant-dialog";
import Link from "next/link";

export default async function TenantsIndexPage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const launcher = await fetchPortalLauncher(session.access_token);
  const permissions = resolvePortalPermissions(launcher.user.organizationRole, launcher.rolePermissions);

  if (!hasPortalPermission(permissions, "tenant:view")) {
    redirect("/");
  }

  const tenants = launcher.tenants;
  const canManageTenants = hasPortalPermission(permissions, "tenant:create");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Tenants</h1>
          <p className="text-sm text-slate-400">
            Browse tenant workspaces that you can access. Select a tenant to manage memberships and applications.
          </p>
        </div>
        {canManageTenants ? <AddTenantDialog organizationId={launcher.user.organizationId} /> : null}
      </header>
      {tenants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
          No tenants available. Create a tenant from the Tasks or organization settings depending on your permissions.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tenants.map((tenant) => (
            <Link
              key={tenant.id}
              href={`/tenants/${tenant.slug ?? tenant.id}`}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-fuchsia-500 hover:text-fuchsia-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-500"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">{tenant.name}</h2>
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  {tenant.slug ?? tenant.id}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span>{tenant.membersCount} members</span>
                <span>{tenant.productsCount} products</span>
              </div>
              {tenant.description ? (
                <p className="mt-3 text-sm text-slate-400">{tenant.description}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
