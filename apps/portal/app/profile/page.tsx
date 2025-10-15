import { redirect } from "next/navigation";
import { SessionList } from "@/components/session-list";
import { ProfileAccountForm } from "@/components/profile-account-form";
import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher } from "@/lib/identity";

export default async function ProfilePage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  let launcherData;
  try {
    launcherData = await fetchPortalLauncher(session.access_token);
  } catch (error) {
    console.error("Failed to load profile data", error);
    redirect("/login");
  }

  const { user, sessions } = launcherData;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Profile & Security</h1>
        <p className="text-slate-400">
          Manage refresh tokens, MFA enrollment, and API keys issued by the identity platform.
        </p>
      </header>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <h2 className="text-lg font-semibold text-white">Account details</h2>
          <p className="mt-1 text-sm text-slate-400">
            Update the name and email associated with your GrowNext portal login.
          </p>
          <div className="mt-4">
            <ProfileAccountForm initialFullName={user.fullName ?? null} initialEmail={user.email} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <h2 className="text-lg font-semibold text-white">Organization</h2>
          <p className="mt-1 text-sm text-slate-400">
            Rename your organization as it appears across tenants and invitations.
          </p>
          <div className="mt-4">
            <OrganizationSettingsForm
              organizationId={user.organizationId}
              initialName={user.organizationName}
              canEdit={user.organizationRole === "OWNER" || user.organizationRole === "ADMIN"}
            />
          </div>
        </div>
      </section>
      <SessionList sessions={sessions} />
    </div>
  );
}
