import Link from "next/link";
import type { PortalTenantSummary } from "@ma/contracts";
import { AddTenantDialog } from "./add-tenant-dialog";

interface TenantOverviewProps {
  tenants: PortalTenantSummary[];
  organizationId: string;
  canManageTenants: boolean;
}

export function TenantOverview({ tenants, organizationId, canManageTenants }: TenantOverviewProps) {
  const emptyMessage = canManageTenants
    ? "No tenants yet. Add a tenant to get started."
    : "No tenants have been assigned to you yet.";

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Tenants</h2>
        {canManageTenants ? <AddTenantDialog organizationId={organizationId} /> : null}
      </header>
      {tenants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
          {emptyMessage}
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
                <h3 className="text-base font-semibold text-white">{tenant.name}</h3>
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  {tenant.slug ?? "n/a"}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span>{tenant.membersCount} members</span>
                <span>{tenant.productsCount} products</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
