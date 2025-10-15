import { redirect } from "next/navigation";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { InvitationsTable } from "@/components/invitations-table";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher, fetchOrganizationDetail } from "@/lib/identity";
import { hasPortalPermission, resolvePortalPermissions } from "@/lib/portal-permissions";

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

export default async function MembersPage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  let launcher;
  try {
    launcher = await fetchPortalLauncher(session.access_token);
  } catch (error) {
    console.error("Failed to load launcher data", error);
    redirect("/login");
  }

  const organizationId = launcher.user.organizationId;
  const permissions = resolvePortalPermissions(launcher.user.organizationRole);

  if (!hasPortalPermission(permissions, "members:view")) {
    redirect("/");
  }

  const canInvite = hasPortalPermission(permissions, "members:invite");
  const canManageMembers = hasPortalPermission(permissions, "members:manage");

  let detail: Awaited<ReturnType<typeof fetchOrganizationDetail>> | null = null;
  try {
    detail = await fetchOrganizationDetail(session.access_token, organizationId);
  } catch (error) {
    const message = (error as Error).message.toLowerCase();
    if (!(message.includes("forbidden") || message.includes("(403)"))) {
      throw error;
    }
  }

  const members = (detail?.members ?? []).slice().sort((a, b) => {
    const nameA = a.user.fullName?.toLowerCase() ?? a.user.email.toLowerCase();
    const nameB = b.user.fullName?.toLowerCase() ?? b.user.email.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Members</h1>
          <p className="text-sm text-slate-400">
            Manage organization-level access and invitations.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <InviteMemberDialog organizationId={organizationId} canInvite={canInvite} />
          {!canInvite ? (
            <p className="text-xs text-slate-500">
              You currently have read-only access to the member directory.
            </p>
          ) : null}
        </div>
      </header>
      {!detail ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
          You can view your own membership details, but additional permissions are required to see the full member roster.
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Member</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-300">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3 text-white">{member.user.fullName ?? "—"}</td>
                <td className="px-4 py-3">{member.user.email}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">{member.role}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDate(member.createdAt)}</td>
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                  No members yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Invitations</h2>
        </div>
        <InvitationsTable
          organizationId={organizationId}
          invitations={(detail?.invitations ?? []).map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status:
              invitation.status === "PENDING" && new Date(invitation.expiresAt).getTime() < Date.now()
                ? "EXPIRED"
                : invitation.status,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt
          }))}
          canManage={canManageMembers}
        />
      </section>
    </div>
  );
}
