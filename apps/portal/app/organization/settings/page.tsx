import { redirect } from "next/navigation";
import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher } from "@/lib/identity";
import { hasPortalPermission, resolvePortalPermissions } from "@/lib/portal-permissions";

export default async function OrganizationSettingsPage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const launcher = await fetchPortalLauncher(session.access_token);
  const permissions = resolvePortalPermissions(launcher.user.organizationRole);

  if (!hasPortalPermission(permissions, "organization:view")) {
    redirect("/");
  }

  const canEdit = hasPortalPermission(permissions, "organization:update");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Organization Settings</h1>
        <p className="text-sm text-slate-400">
          Control how your organization appears across the portal, manage billing preferences, and keep administrative
          details up to date.
        </p>
      </header>
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <h2 className="text-lg font-semibold text-white">Profile</h2>
        <p className="mt-1 text-sm text-slate-400">
          Update the organization name as it appears in invitations, tenant headers, and identity screens.
        </p>
        <div className="mt-4">
          <OrganizationSettingsForm
            organizationId={launcher.user.organizationId}
            initialName={launcher.user.organizationName}
            canEdit={canEdit}
          />
          {!canEdit ? (
            <p className="mt-3 text-xs text-slate-500">
              You need the <code>organization:update</code> permission to modify organization details.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
