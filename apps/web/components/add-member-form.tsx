"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AddOrganizationMemberRequestSchema,
  OrganizationMemberSchema,
  type OrganizationRole
} from "@ma/contracts";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";
import { getApiBaseUrl } from "@/lib/api";

interface AddMemberFormProps {
  allowedRoles: OrganizationRole[];
}

const computeDefaultRole = (roles: OrganizationRole[]): OrganizationRole => {
  if (roles.includes("ADMIN")) {
    return "ADMIN";
  }
  if (roles.includes("MEMBER")) {
    return "MEMBER";
  }
  return roles[0] ?? "MEMBER";
};

export const AddMemberForm = ({ allowedRoles }: AddMemberFormProps) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>(() => computeDefaultRole(allowedRoles));
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!allowedRoles.includes(role)) {
      setRole(computeDefaultRole(allowedRoles));
    }
  }, [allowedRoles, role]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const parsed = AddOrganizationMemberRequestSchema.safeParse({
      email,
      role,
      fullName: fullName.trim() === "" ? undefined : fullName.trim()
    });

    if (!parsed.success) {
      setStatus("error");
      setMessage("Please provide a valid email");
      return;
    }

    if (!allowedRoles.includes(parsed.data.role)) {
      setStatus("error");
      setMessage("You do not have permission to assign this role");
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
      const response = await fetch(`${getApiBaseUrl()}/organization/members`, {
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
        setMessage(body?.error ?? "Unable to add member");
        return;
      }

      OrganizationMemberSchema.parse(body);
      setStatus("success");
      setEmail("");
      setFullName("");
      setRole(computeDefaultRole(allowedRoles));
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <Card data-testid="add-member-card">
      <CardHeader>
        <h2 className="text-xl font-semibold" data-testid="add-member-heading">
          Add an existing user
        </h2>
        <p className="text-sm text-muted-foreground">
          Add a teammate who already has a GrowNext account by assigning them to your organization.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="add-member-form">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="add-email">
              Email
            </label>
            <input
              id="add-email"
              type="email"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="teammate@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="add-member-email"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="add-role">
                Role
              </label>
              <select
                id="add-role"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={role}
                onChange={(event) => setRole(event.target.value as OrganizationRole)}
                disabled={allowedRoles.length === 0}
                data-testid="add-member-role"
              >
                {allowedRoles.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="add-full-name">
                Full name <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="add-full-name"
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Taylor Lee"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                data-testid="add-member-full-name"
              />
            </div>
          </div>
          <Button type="submit" disabled={status === "loading"} data-testid="add-member-submit">
            {status === "loading" ? "Adding member..." : "Add member"}
          </Button>
          {message && (
            <p
              className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="add-member-message"
            >
              {message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
