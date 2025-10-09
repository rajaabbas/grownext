import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@ma/ui";
import {
  OrganizationInvitationsResponseSchema,
  OrganizationMembersResponseSchema,
  OrganizationSchema,
  type OrganizationRole
} from "@ma/contracts";
import { getApiBaseUrl } from "@/lib/api";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { OrganizationSettingsForm } from "@/components/organization-settings-form";
import { InviteMemberForm } from "@/components/invite-member-form";
import { AddMemberForm } from "@/components/add-member-form";
import { MemberActions } from "@/components/member-actions";
import { RevokeInvitationButton } from "@/components/revoke-invitation-button";

const getBaseInviteUrl = (): string => {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
};

export default async function OrganizationPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const apiBaseUrl = getApiBaseUrl();
  const cookieHeader = headers().get("cookie") ?? "";

  const fetchWithAuth = (path: string) =>
    fetch(`${apiBaseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        // Forward Supabase auth cookies so the API can extract claims
        ...(cookieHeader ? { cookie: cookieHeader } : {})
      },
      cache: "no-store"
    });

  const organizationRes = await fetchWithAuth("/organization");

  if (organizationRes.status === 404) {
    redirect("/signup");
  }

  if (!organizationRes.ok) {
    throw new Error("Failed to load organization");
  }

  const [membersRes, invitationsRes] = await Promise.all([
    fetchWithAuth("/organization/members"),
    fetchWithAuth("/organization/invitations")
  ]);

  if (!membersRes.ok || !invitationsRes.ok) {
    throw new Error("Failed to load organization data");
  }

  const organization = OrganizationSchema.parse(await organizationRes.json());
  const membersPayload = OrganizationMembersResponseSchema.parse(await membersRes.json());
  const invitationsPayload = OrganizationInvitationsResponseSchema.parse(await invitationsRes.json());

  const baseInviteUrl = getBaseInviteUrl();

  const viewerMembership = user ? membersPayload.members.find((member) => member.userId === user.id) : null;
  const isOwner = viewerMembership?.role === "OWNER";
  const isAdmin = viewerMembership?.role === "ADMIN";
  const viewerUserId = user?.id ?? null;
  const canManageMembers = isOwner || isAdmin;
  const allowedManagementRoles: OrganizationRole[] = isOwner
    ? ["OWNER", "ADMIN", "MEMBER"]
    : isAdmin
      ? ["ADMIN", "MEMBER"]
      : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Organization</h1>
      <OrganizationSettingsForm organization={organization} />

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">
            Everyone with access to this workspace. Owners and admins can manage membership.
          </p>
        </CardHeader>
        <CardContent>
          {membersPayload.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet. Invite someone to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Joined</th>
                    {canManageMembers ? <th className="pb-2 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {membersPayload.members.map((member) => (
                    <tr key={member.id} className="py-2">
                      <td className="py-2 font-medium">{member.fullName ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">{member.email}</td>
                      <td className="py-2">
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium uppercase">
                          {member.role}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </td>
                      {canManageMembers ? (
                        <td className="py-2 align-middle">
                          <MemberActions
                            memberId={member.id}
                            memberRole={member.role}
                            allowedRoles={allowedManagementRoles}
                            viewerUserId={viewerUserId}
                            memberUserId={member.userId}
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canManageMembers ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <InviteMemberForm baseInviteUrl={baseInviteUrl} allowedRoles={allowedManagementRoles} />
          <AddMemberForm allowedRoles={allowedManagementRoles} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Pending invitations</h2>
          <p className="text-sm text-muted-foreground">
            Share these invite links with teammates. Each link expires automatically after the
            configured period.
          </p>
        </CardHeader>
        <CardContent>
          {invitationsPayload.invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {invitationsPayload.invitations.map((invitation) => {
                const invitationLink = invitation.token
                  ? `${baseInviteUrl}/invitations/${invitation.token}`
                  : null;

                return (
                  <li key={invitation.id} className="rounded-md border border-dashed px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium">{invitation.email}</span>
                          <span className="text-xs uppercase text-muted-foreground">{invitation.role}</span>
                        </div>
                        {invitationLink ? (
                          <p className="break-all text-xs text-muted-foreground">{invitationLink}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Invite link hidden for security.{" "}
                            {invitation.tokenHint ? `Hint: …${invitation.tokenHint}` : ""}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(invitation.expiresAt).toLocaleString()}
                        </p>
                      </div>
                      {canManageMembers ? (
                        <RevokeInvitationButton
                          invitationId={invitation.id}
                          disabled={invitation.status !== "PENDING"}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
