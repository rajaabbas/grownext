"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrganizationRoleSchema, type OrganizationRole } from "@ma/contracts";
import { Button } from "@ma/ui";
import { getApiBaseUrl } from "@/lib/api";

interface MemberActionsProps {
  memberId: string;
  memberRole: OrganizationRole;
  allowedRoles: OrganizationRole[];
  viewerUserId: string | null;
  memberUserId: string;
}

export const MemberActions = ({
  memberId,
  memberRole,
  allowedRoles,
  viewerUserId,
  memberUserId
}: MemberActionsProps) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<OrganizationRole>(memberRole);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const canAssignOwner = allowedRoles.includes("OWNER");
  const disableRoleSelect = memberRole === "OWNER" && !canAssignOwner;
  const disableRemoval = memberRole === "OWNER" && !canAssignOwner;
  const isSelf = viewerUserId === memberUserId;

  const handleRoleChange = async (nextRole: OrganizationRole) => {
    if (nextRole === memberRole) {
      return;
    }

    const previousRole = pendingRole;

    setStatus("loading");
    setMessage(null);
    setPendingRole(nextRole);

    try {
      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.getUser()
      ]);

      if (!sessionData.session || !userData.user) {
        setStatus("error");
        setMessage("You are not logged in");
        return;
      }

      const response = await fetch(`${getApiBaseUrl()}/organization/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({ role: nextRole })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setStatus("error");
        setMessage(body?.error ?? "Unable to update member role");
        setPendingRole(previousRole);
        return;
      }

      setStatus("success");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
      setPendingRole(previousRole);
    }
  };

  const handleRemoval = async () => {
    setStatus("loading");
    setMessage(null);

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setStatus("error");
        setMessage("You are not logged in");
        return;
      }

      const response = await fetch(`${getApiBaseUrl()}/organization/members/${memberId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setStatus("error");
        setMessage(body?.error ?? "Unable to remove member");
        return;
      }

      setStatus("success");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <div className="flex flex-col items-end gap-2" data-testid={`member-actions-${memberId}`}>
      <select
        className="w-full min-w-32 rounded-md border border-input bg-background px-2 py-1 text-sm"
        value={pendingRole}
        onChange={(event) =>
          handleRoleChange(
            OrganizationRoleSchema.parse(event.target.value as OrganizationRole)
          )
        }
        disabled={disableRoleSelect || status === "loading"}
        data-testid={`member-role-select-${memberId}`}
      >
        {allowedRoles.map((role) => (
          <option key={role} value={role}>
            {role.charAt(0) + role.slice(1).toLowerCase()}
          </option>
        ))}
        {!allowedRoles.includes(memberRole) ? (
          <option value={memberRole}>{memberRole}</option>
        ) : null}
      </select>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRemoval}
        disabled={disableRemoval || status === "loading" || isSelf}
        data-testid={`member-remove-${memberId}`}
      >
        {status === "loading" ? "Updating…" : "Remove"}
      </Button>
      {message ? (
        <p className="max-w-xs text-right text-xs text-destructive" data-testid={`member-message-${memberId}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
};
