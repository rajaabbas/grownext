"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpdatePasswordRequestSchema, UpdatePasswordResponseSchema } from "@ma/contracts";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";
import { getApiBaseUrl } from "@/lib/api";

export const PasswordChangeCard = () => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setStatus("error");
      setMessage("New passwords do not match.");
      return;
    }

    const parsed = UpdatePasswordRequestSchema.safeParse({
      currentPassword,
      newPassword,
      mfaCode: mfaCode.trim() === "" ? undefined : mfaCode.trim()
    });

    if (!parsed.success) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    const normalizedMfaCode = mfaCode.replace(/\s+/g, "");
    if (mfaRequired && normalizedMfaCode.length !== 6) {
      setStatus("error");
      setMessage("Enter the 6-digit authenticator code.");
      return;
    }

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token ?? null;

      const response = await fetch(`${getApiBaseUrl()}/profile/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        credentials: "include",
        body: JSON.stringify({
          ...parsed.data,
          mfaCode:
            parsed.data.mfaCode ?? (normalizedMfaCode.length === 6 ? normalizedMfaCode : undefined)
        })
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (body?.errorCode === "mfa_required") {
          setMfaRequired(true);
        }
        setStatus("error");
        setMessage(body?.error ?? "Unable to update password.");
        return;
      }

      const result = UpdatePasswordResponseSchema.parse(body);

      setStatus("success");
      setMessage(result.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMfaCode("");
      setMfaRequired(false);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Change password</h2>
        <p className="text-sm text-muted-foreground">
          Update the password for this account. You&rsquo;ll use it the next time you sign in.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="current-password">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
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
                minLength={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>
          {mfaRequired ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="mfa-code">
                Authenticator code
              </label>
              <input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                placeholder="123456"
              />
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code from your authenticator app to finish changing your password.
              </p>
            </div>
          ) : null}
          <Button type="submit" disabled={status === "loading"}>
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
