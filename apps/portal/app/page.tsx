import { redirect } from "next/navigation";
import { AppLauncher } from "@/components/app-launcher";
import { SessionList } from "@/components/session-list";
import { TenantOverview } from "@/components/tenant-overview";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher } from "@/lib/identity";

export default async function PortalHomePage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  let data;

  try {
    data = await fetchPortalLauncher(session.access_token);
  } catch (error) {
    console.error("Failed to load launcher data", error);
    redirect("/login");
  }

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
