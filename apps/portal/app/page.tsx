import { redirect } from "next/navigation";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher } from "@/lib/identity";
import { resolvePortalPermissions } from "@/lib/portal-permissions";

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

  const permissions = resolvePortalPermissions(data.user.organizationRole);
  const tenantCount = data.tenants.length;
  const totalMembers = data.tenants.reduce((sum, tenant) => sum + tenant.membersCount, 0);
  const activeSessions = data.sessions.length;

  const stats = [
    {
      label: "Tenants",
      value: tenantCount,
      description: "Total workspaces you can access"
    },
    {
      label: "Active sessions",
      value: activeSessions,
      description: "Refresh tokens currently active"
    },
    {
      label: "Members across tenants",
      value: totalMembers,
      description: "Sum of members in all tenants"
    }
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">
          High level summary of your organization activity.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-slate-300"
          >
            <p className="text-sm uppercase tracking-wide text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
