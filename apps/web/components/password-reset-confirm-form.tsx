"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";

export const PasswordResetConfirmForm = () => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    const tryRestoreSession = async () => {
      if (typeof window === "undefined") {
        return;
      }

      const searchParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = searchParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token");

      if (!accessToken || !refreshToken) {
        const {
          data: { session }
        } = await supabase.auth.getSession();

        setHasRecoverySession((session?.user ?? null) !== null);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (error) {
        setHasRecoverySession(false);
        setStatus("error");
        setMessage(error.message);
        return;
      }

      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setStatus("error");
        setMessage("The recovery link has expired or is invalid. Request another and try again.");
      }

      setHasRecoverySession((session?.user ?? null) !== null);
    };

    void tryRestoreSession();
  }, [supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setStatus("success");
      setMessage("Password updated. Sign in with your new credentials.");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <h2 className="text-xl font-semibold">Choose a new password</h2>
        <p className="text-sm text-muted-foreground">
          Pick a strong password to secure your account. This link expires shortly after issuance.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="confirm-new-password">
              Confirm password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {!hasRecoverySession ? (
            <p className="text-xs text-destructive">
              The recovery link has expired or is invalid. Request a new password reset to continue.
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={status === "loading" || !hasRecoverySession}>
            {status === "loading" ? "Updating..." : "Update password"}
          </Button>
          {message ? (
            <p
              className={`text-sm ${
                status === "error" ? "text-destructive" : status === "success" ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              {message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};
