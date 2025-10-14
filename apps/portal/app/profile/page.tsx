import { redirect } from "next/navigation";
import { SessionList } from "@/components/session-list";
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
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <h2 className="text-lg font-semibold text-white">Account details</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-slate-300">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">User ID</dt>
            <dd className="text-base text-slate-100">{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="text-base text-slate-100">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Organization</dt>
            <dd className="text-base text-slate-100">{user.organizationName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">MFA</dt>
            <dd className="text-base text-emerald-300">TOTP enabled</dd>
          </div>
        </dl>
        <div className="mt-6 flex gap-3 text-sm">
          <button className="rounded-md border border-slate-700 px-3 py-2 text-slate-300 hover:border-fuchsia-500 hover:text-fuchsia-200">
            Rotate API key
          </button>
          <button className="rounded-md border border-slate-700 px-3 py-2 text-slate-300 hover:border-emerald-500 hover:text-emerald-200">
            Configure MFA
          </button>
        </div>
      </section>
      <SessionList sessions={sessions} />
    </div>
  );
}
