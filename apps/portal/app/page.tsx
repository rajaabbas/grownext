import { redirect } from "next/navigation";
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

  const organizationRole = data.user.organizationRole;
  const canManageTenants = organizationRole === "OWNER" || organizationRole === "ADMIN";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
      <TenantOverview
        tenants={data.tenants}
        organizationId={data.user.organizationId}
        canManageTenants={canManageTenants}
      />
    </div>
  );
}
