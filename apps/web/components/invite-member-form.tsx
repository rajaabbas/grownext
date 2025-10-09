"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CreateOrganizationInvitationRequestSchema,
  OrganizationInvitationSchema,
  OrganizationRoleSchema,
  type OrganizationRole
} from "@ma/contracts";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";
import { getApiBaseUrl } from "@/lib/api";

interface InviteMemberFormProps {
  baseInviteUrl: string;
  allowedRoles: OrganizationRole[];
}

const resolveDefaultRole = (roles: OrganizationRole[]): OrganizationRole => {
  if (roles.includes("MEMBER")) return "MEMBER";
  if (roles.includes("ADMIN")) return "ADMIN";
  return roles[0] ?? "MEMBER";
};

export const InviteMemberForm = ({ baseInviteUrl, allowedRoles }: InviteMemberFormProps) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>(resolveDefaultRole(allowedRoles));
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [latestToken, setLatestToken] = useState<string | null>(null);

  useEffect(() => {
    if (!allowedRoles.includes(role)) {
      setRole(resolveDefaultRole(allowedRoles));
    }
  }, [allowedRoles, role]);

  const availableRoles = useMemo(
    () => OrganizationRoleSchema.options.filter((option) => allowedRoles.includes(option)),
    [allowedRoles]
  );

  const invitationLink = useMemo(() => {
    if (!latestToken) {
      return null;
    }
    return `${baseInviteUrl}/invitations/${latestToken}`;
  }, [baseInviteUrl, latestToken]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    if (availableRoles.length === 0) {
      setStatus("error");
      setMessage("You do not have permission to invite members.");
      return;
    }

    const parsed = CreateOrganizationInvitationRequestSchema.safeParse({
      email,
      role,
      expiresInHours
    });

    if (!parsed.success) {
      setStatus("error");
      setMessage("Please provide a valid email and expiry");
      return;
    }

    if (!allowedRoles.includes(parsed.data.role)) {
      setStatus("error");
      setMessage("You do not have permission to assign this role.");
      return;
    }

    const [{ data: sessionData }, { data: userData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser()
    ]);

    if (!sessionData.session || !userData.user) {
      setStatus("error");
      setMessage("You are not logged in");
      return;
    }

    const session = sessionData.session;

    try {
      const response = await fetch(`${getApiBaseUrl()}/organization/invitations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(parsed.data)
      });

      const body = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(body?.error ?? "Unable to create invitation");
        return;
      }

      const invitation = OrganizationInvitationSchema.parse(body);
      setLatestToken(invitation.token ?? null);
      setStatus("success");
      setEmail("");
      setRole(resolveDefaultRole(allowedRoles));
      setExpiresInHours(72);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <Card data-testid="invite-member-card">
      <CardHeader>
        <h2 className="text-xl font-semibold" data-testid="invite-member-heading">
          Invite a team member
        </h2>
        <p className="text-sm text-muted-foreground">
          Send a secure invite link to a teammate. Invited users will create their own credentials
          before gaining access to your organization.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="invite-member-form">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="invite-email">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="collaborator@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="invite-email"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invite-role">
                Role
              </label>
              <select
                id="invite-role"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={role}
                onChange={(event) => setRole(event.target.value as OrganizationRole)}
                disabled={availableRoles.length === 0}
                data-testid="invite-role"
              >
                {availableRoles.map((option) => {
                  const formatted = option.charAt(0) + option.slice(1).toLowerCase();
                  return (
                    <option key={option} value={option}>
                      {formatted}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invite-expiry">
                Expiration (hours)
              </label>
              <input
                id="invite-expiry"
                type="number"
                min={1}
                max={720}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={expiresInHours}
                onChange={(event) => setExpiresInHours(Number(event.target.value))}
                data-testid="invite-expiry"
              />
            </div>
          </div>
          <Button type="submit" disabled={status === "loading"} data-testid="invite-submit">
            {status === "loading" ? "Creating invite..." : "Send invitation"}
          </Button>
          {message && (
            <p
              className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="invite-message"
            >
              {message}
            </p>
          )}
          {invitationLink && (
            <div
              className="space-y-1 rounded-md border border-dashed px-3 py-2 text-xs"
              data-testid="invite-latest-link"
            >
              <p className="font-medium text-muted-foreground">Invitation link</p>
              <p className="break-all">{invitationLink}</p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
