import Link from "next/link";
import type { PortalTenantSummary } from "@ma/contracts";

interface TenantOverviewProps {
  tenants: PortalTenantSummary[];
}

export function TenantOverview({ tenants }: TenantOverviewProps) {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Tenants</h2>
          <p className="text-sm text-slate-400">
            Manage environments and invitations for your organization.
          </p>
        </div>
        <Link
          href="/tenants"
          className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-200 hover:border-fuchsia-500"
        >
          Manage tenants
        </Link>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {tenants.map((tenant) => (
          <div
            key={tenant.id}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{tenant.name}</h3>
              <span className="text-xs uppercase tracking-wide text-slate-500">{tenant.slug ?? "n/a"}</span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
              <span>{tenant.membersCount} members</span>
              <span>{tenant.productsCount} products</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
