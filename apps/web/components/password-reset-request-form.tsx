"use client";

import { useState } from "react";
import { PasswordResetRequestSchema, PasswordResetResponseSchema } from "@ma/contracts";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";
import { getApiBaseUrl } from "@/lib/api";

export const PasswordResetRequestForm = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [verificationLink, setVerificationLink] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);
    setVerificationLink(null);

    const parsed = PasswordResetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setStatus("error");
      setMessage("Please enter a valid email address");
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/password/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(parsed.data)
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus("error");
        setMessage(body?.error ?? "Unable to start the password reset flow");
        return;
      }

      const result = PasswordResetResponseSchema.parse(body);
      setStatus("success");
      setMessage(result.message);
      const shouldShowLink =
        process.env.NODE_ENV !== "production" && typeof result.verificationLink === "string";
      setVerificationLink(shouldShowLink && result.verificationLink ? result.verificationLink : null);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <Card className="max-w-md" data-testid="password-reset-card">
      <CardHeader>
        <h2 className="text-xl font-semibold" data-testid="password-reset-heading">
          Reset your password
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter the email associated with your account and we&apos;ll send you a secure reset link.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit} data-testid="password-reset-form">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="reset-email">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="password-reset-email"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={status === "loading"}
            data-testid="password-reset-submit"
          >
            {status === "loading" ? "Sending..." : "Send reset link"}
          </Button>
          {message ? (
            <p
              className={`text-sm ${
                status === "error" ? "text-destructive" : status === "success" ? "text-emerald-600" : "text-muted-foreground"
              }`}
              data-testid="password-reset-message"
            >
              {message}
            </p>
          ) : null}
          {verificationLink ? (
            <p className="break-all text-xs text-muted-foreground" data-testid="password-reset-link">
              Dev helper: <span className="font-medium">{verificationLink}</span>
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};
