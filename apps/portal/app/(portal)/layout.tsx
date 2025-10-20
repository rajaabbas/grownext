import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { PerformanceMetricsProvider } from "@/components/performance-metrics-provider";
import { PortalHeader } from "@/components/portal-header";
import { fetchPortalLauncher } from "@/lib/identity";
import { resolvePortalPermissions, hasPortalPermission } from "@/lib/portal-permissions";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  let launcherData: Awaited<ReturnType<typeof fetchPortalLauncher>> | null = null;

  try {
    launcherData = await fetchPortalLauncher(session.access_token);
  } catch (error) {
    console.error("Failed to load portal launcher data", error);
  }

  const permissions = resolvePortalPermissions(
    launcherData?.user.organizationRole ?? null,
    launcherData?.rolePermissions
  );

  const user = {
    email: launcherData?.user.email ?? session.user.email ?? "",
    fullName: launcherData?.user.fullName ?? session.user.user_metadata?.full_name ?? "",
    organization: launcherData?.user.organizationName ?? ""
  };

  return (
    <>
      <PerformanceMetricsProvider />
      <PortalHeader user={user} permissions={permissions} />
      {launcherData?.impersonation ? (
        <ImpersonationBanner impersonation={launcherData.impersonation} />
      ) : null}
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-xl">{children}</div>
        <footer className="mt-10 flex items-center justify-between text-sm text-slate-500">
          <span>&copy; {new Date().getFullYear()} GrowNext Platform</span>
          <nav className="flex gap-4">
            {hasPortalPermission(permissions, "tenant:view") ? (
              <Link className="hover:text-slate-200" href="/tenants">
                Tenants
              </Link>
            ) : null}
            <Link className="hover:text-slate-200" href="/profile">
              Profile
            </Link>
            <Link className="hover:text-slate-200" href="/docs">
              Docs
            </Link>
          </nav>
        </footer>
      </main>
    </>
  );
}
