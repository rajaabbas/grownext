"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthFlowResponseSchema, SignUpRequestSchema } from "@ma/contracts";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";
import { getApiBaseUrl } from "@/lib/api";

export const SignupForm = () => {
  const supabase = useSupabaseClient();
  const router = useRouter();

  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
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
      setMessage("Passwords do not match.");
      return;
    }

    const parsedRequest = SignUpRequestSchema.safeParse({
      organizationName,
      organizationSlug: organizationSlug.trim() === "" ? undefined : organizationSlug.trim(),
      fullName,
      email,
      password
    });

    if (!parsedRequest.success) {
      setStatus("error");
      setMessage("Please review the form fields and try again.");
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsedRequest.data)
      });

      const body = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(body?.error ?? "Unable to create organization.");
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
            ? " (For local development, you can follow this link to complete verification immediately.)"
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
      setMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  };

  return (
    <Card className="w-full max-w-xl" data-testid="signup-card">
      <CardHeader>
        <h2 className="text-xl font-semibold" data-testid="signup-heading">
          Create your organization
        </h2>
        <p className="text-sm text-muted-foreground">
          Provision a new workspace and your first administrator account.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="signup-form">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="organization-name">
              Organization name
            </label>
            <input
              id="organization-name"
              type="text"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Acme Inc"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              data-testid="signup-organization-name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="organization-slug">
              Slug <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="organization-slug"
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="acme"
              value={organizationSlug}
              onChange={(event) => setOrganizationSlug(event.target.value)}
              data-testid="signup-organization-slug"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="full-name">
              Your name
            </label>
            <input
              id="full-name"
              type="text"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              data-testid="signup-full-name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="signup-email"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="********"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                data-testid="signup-password"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="********"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                data-testid="signup-confirm-password"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={status === "loading"}
            data-testid="signup-submit"
          >
            {status === "loading" ? "Creating workspace..." : "Create organization"}
          </Button>
          <p
            className={`text-sm ${
              message
                ? status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
            : "invisible text-muted-foreground"
            }`}
            role="status"
            aria-live="polite"
            data-testid="signup-message"
          >
            {message ?? ""}
          </p>
        </form>
      </CardContent>
    </Card>
  );
};
