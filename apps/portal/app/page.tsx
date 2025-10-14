import { AppLauncher } from "@/components/app-launcher";
import { SessionList } from "@/components/session-list";
import { TenantOverview } from "@/components/tenant-overview";
import { mockLauncherData } from "@/lib/mock-data";

export default function PortalHomePage() {
  const data = mockLauncherData;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <header>
          <h1 className="text-3xl font-semibold text-white">Welcome back, {data.user.email}</h1>
          <p className="text-slate-400">
            Launch entitled products, manage tenants, and oversee platform access from one place.
          </p>
        </header>
        <AppLauncher products={data.products} />
      </section>
      <TenantOverview tenants={data.tenants} />
      <SessionList sessions={data.sessions} />
    </div>
  );
}
