import { redirect } from "next/navigation";
import type { PortalSupportLink } from "@ma/contracts";
import { LaunchpadDashboard } from "@/components/launchpad-dashboard";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher } from "@/lib/identity";

const FALLBACK_SUPPORT_LINKS: PortalSupportLink[] = [
  {
    label: "Tenant Support Runbook",
    href: "/docs/operations/runbooks/identity",
    description: "Escalation steps, impersonation safeguards, and recovery guidance.",
    external: false
  }
];

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

  const stats = [
    {
      label: "Tenants",
      value: data.tenants.length,
      description: "Tenants you can access."
    },
    {
      label: "Active sessions",
      value: data.sessions.length,
      description: "Refresh tokens currently active."
    },
    {
      label: "Members across tenants",
      value: data.tenantMembersCount,
      description: "Sum of members in all tenants."
    }
  ];

  const adminActions = data.adminActions ?? [];
  const notifications = data.notifications ?? [];
  const supportLinks = data.supportLinks.length > 0 ? data.supportLinks : FALLBACK_SUPPORT_LINKS;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Launchpad</h1>
        <p className="text-sm text-slate-400">
          Keep tabs on privileged activity, bulk job notifications, and quick operational links.
        </p>
      </header>
      <LaunchpadDashboard
        stats={stats}
        adminActions={adminActions}
        notifications={notifications}
        supportLinks={supportLinks}
      />
    </div>
  );
}
