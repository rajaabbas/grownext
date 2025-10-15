import Link from "next/link";
import { InviteAcceptance } from "@/components/invite-acceptance";
import { InviteOnboardingForm } from "@/components/invite-onboarding-form";
import { previewOrganizationInvitation } from "@/lib/identity";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";

interface InvitePageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const tokenParam = searchParams?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-white">Invitation link invalid</h1>
          <p className="text-sm text-slate-400">
            The invitation link is missing a token. Please use the full link that was provided.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-100"
        >
          Back to portal
        </Link>
      </main>
    );
  }

  let invitationPreview: Awaited<ReturnType<typeof previewOrganizationInvitation>> | null = null;
  let previewError: string | null = null;

  try {
    invitationPreview = await previewOrganizationInvitation(token);
  } catch (error) {
    previewError = (error as Error).message;
  }

  const invitation = invitationPreview?.invitation ?? null;

  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const nextPath = `/auth/invite?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-white">Accept invitation</h1>
          <p className="text-sm text-slate-400">
            Join your organization by accepting the invitation below.
          </p>
        </header>

        {previewError ? (
          <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Failed to load invitation details: {previewError}
          </div>
        ) : null}

        {!previewError && !invitation ? (
          <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Invitation not found or no longer available.
          </div>
        ) : null}

        {invitation ? (
          <section className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
              <dl className="space-y-2">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Organization</dt>
                  <dd className="font-medium text-white">{invitation.organizationName}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Invited email</dt>
                  <dd className="font-medium text-white">{invitation.email}</dd>
                </div>
                {invitation.tenantName ? (
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Tenant</dt>
                    <dd className="font-medium text-white">{invitation.tenantName}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Role</dt>
                  <dd className="font-medium uppercase tracking-wide text-slate-200">
                    {invitation.role}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd
                    className={`font-medium uppercase tracking-wide ${
                      invitation.status === "PENDING"
                        ? "text-emerald-300"
                        : invitation.status === "EXPIRED"
                          ? "text-amber-300"
                          : "text-slate-300"
                    }`}
                  >
                    {invitation.status}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Expires</dt>
                  <dd className="text-slate-200">{formatDateTime(invitation.expiresAt)}</dd>
                </div>
              </dl>
            </div>

            {invitation.status !== "PENDING" ? (
              <div className="rounded-md border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
                This invitation can no longer be accepted. Please request a new invitation from your
                administrator.
              </div>
            ) : null}

            {invitation.status === "PENDING" ? (
              session ? (
                <InviteAcceptance token={token} redirectTo="/members" />
              ) : (
                <div className="space-y-4">
                  <InviteOnboardingForm email={invitation.email} />
                  <div className="rounded-md border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
                    <p className="text-center">
                      Already have an account? <Link href={loginHref} className="text-fuchsia-300 hover:underline">Sign in</Link> or
                      finish registration from the <Link href={signupHref} className="text-fuchsia-300 hover:underline">standard sign-up page</Link>.
                    </p>
                  </div>
                </div>
              )
            ) : null}
          </section>
        ) : null}
      </div>
      <div className="text-center text-xs text-slate-500">
        Having trouble? Contact your administrator to request a fresh invitation.
      </div>
    </main>
  );
}
