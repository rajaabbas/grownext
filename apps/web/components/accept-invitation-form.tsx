"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AcceptInvitationRequestSchema, AuthFlowResponseSchema } from "@ma/contracts";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";
import { getApiBaseUrl } from "@/lib/api";

interface AcceptInvitationFormProps {
  token: string;
  organizationName: string;
  email: string;
  role: string;
}

export const AcceptInvitationForm = ({ token, organizationName, email, role }: AcceptInvitationFormProps) => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match");
      return;
    }

    const parsed = AcceptInvitationRequestSchema.safeParse({
      token,
      fullName,
      password
    });

    if (!parsed.success) {
      setStatus("error");
      setMessage("Please review the form fields");
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data)
      });

      const body = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(body?.error ?? "Unable to accept invitation");
        return;
      }

      const result = AuthFlowResponseSchema.parse(body);

      if (result.status === "session") {
        const { session } = result;
        const { error } = await supabase.auth.setSession({
          access_token: session.accessToken,
          refresh_token: session.refreshToken
        });

        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }

        setStatus("success");
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const showVerificationHint =
        process.env.NODE_ENV !== "production" && typeof result.verificationLink === "string";

      setStatus("success");
      setMessage(
        `${result.message}${
          showVerificationHint
            ? " (For local development you can follow this verification link immediately.)"
            : ""
        }`
      );
      setPassword("");
      setConfirmPassword("");
      if (showVerificationHint && result.verificationLink) {
        console.info("Email verification link", result.verificationLink);
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <Card className="max-w-xl" data-testid="accept-invitation-card">
      <CardHeader>
        <h2 className="text-xl font-semibold" data-testid="accept-invitation-heading">
          Join {organizationName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Create your password to join as a {role.toLowerCase()} and start collaborating with your
          team.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="accept-invitation-form">
          <div className="space-y-1">
            <span className="text-sm font-medium text-muted-foreground">Email</span>
            <p className="rounded-md border border-dashed px-3 py-2 text-sm" data-testid="accept-invitation-email">
              {email}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="invite-full-name">
              Full name
            </label>
            <input
              id="invite-full-name"
              type="text"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              data-testid="accept-invitation-full-name"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invite-password">
                Password
              </label>
              <input
                id="invite-password"
                type="password"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                data-testid="accept-invitation-password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="invite-confirm-password">
                Confirm password
              </label>
              <input
                id="invite-confirm-password"
                type="password"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                data-testid="accept-invitation-confirm-password"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={status === "loading"}
            data-testid="accept-invitation-submit"
          >
            {status === "loading" ? "Creating account..." : "Join organization"}
          </Button>
          {message && (
            <p
              className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="accept-invitation-message"
            >
              {message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
