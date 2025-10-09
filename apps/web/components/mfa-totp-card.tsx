"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";

interface TotpEnrollmentState {
  factorId: string;
  qrCode: string | null;
  secret: string | null;
  challengeId: string | null;
}

export const MfaTotpCard = () => {
  const supabase = useSupabaseClient();
  const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollmentState | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      setMessage(error.message);
      setStatus("error");
      return;
    }

    const activeFactor = data?.totp?.[0];
    setEnrolledFactorId(activeFactor?.id ?? null);
    if (!activeFactor) {
      setEnrollment(null);
    }
  }, [supabase]);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  const handleBeginEnrollment = async () => {
    setStatus("loading");
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });

      if (error || !data?.id) {
        setStatus("error");
        setMessage(error?.message ?? "Failed to start enrollment");
        return;
      }

      const challenge = await supabase.auth.mfa.challenge({ factorId: data.id });

      if (challenge.error || !challenge.data?.id) {
        setStatus("error");
        setMessage(challenge.error?.message ?? "Failed to challenge TOTP factor");
        return;
      }

      setEnrollment({
        factorId: data.id,
        qrCode: data.totp?.qr_code ?? null,
        secret: data.totp?.secret ?? null,
        challengeId: challenge.data.id
      });
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unexpected error");
    }
  };

  const handleVerify = async () => {
    if (!enrollment?.factorId || !enrollment.challengeId) {
      return;
    }

    setStatus("loading");
    setMessage(null);

    const verification = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: enrollment.challengeId,
      code
    });

    if (verification.error) {
      setStatus("error");
      setMessage(verification.error.message);
      return;
    }

    setStatus("success");
    setMessage("Authenticator app confirmed. Multi-factor authentication is now enabled.");
    setEnrollment(null);
    setCode("");
    await refreshFactors();
  };

  const handleDisable = async () => {
    if (!enrolledFactorId) {
      return;
    }

    setStatus("loading");
    setMessage(null);

    const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactorId });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    setMessage("Multi-factor authentication disabled.");
    setEnrolledFactorId(null);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold">Multi-factor authentication</h2>
        <p className="text-sm text-muted-foreground">
          Add a one-time password step when signing in to make account takeovers significantly harder.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrolledFactorId ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-600">
            Authenticator app enabled for this account.
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            MFA is currently disabled. Set up an authenticator app to protect your workspace.
          </p>
        )}

        {enrollment ? (
          <div className="space-y-3 rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">Scan this code with your authenticator app:</p>
            {enrollment.qrCode ? (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Authenticator QR Code" src={enrollment.qrCode} className="size-40" />
              </div>
            ) : null}
            {enrollment.secret ? (
              <p className="text-xs text-muted-foreground">
                Or enter this secret manually: <span className="font-mono">{enrollment.secret}</span>
              </p>
            ) : null}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="totp-code">
                Verification code
              </label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
              />
            </div>
            <Button onClick={handleVerify} disabled={status === "loading" || code.length < 6}>
              {status === "loading" ? "Verifying..." : "Confirm setup"}
            </Button>
          </div>
        ) : null}

        {!enrollment ? (
          <div className="flex items-center gap-3">
            <Button onClick={handleBeginEnrollment} disabled={status === "loading" || !!enrollment || !!enrolledFactorId}>
              {enrolledFactorId ? "Authenticator enabled" : "Set up authenticator"}
            </Button>
            {enrolledFactorId ? (
              <Button variant="outline" onClick={handleDisable} disabled={status === "loading"}>
                Disable
              </Button>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p
            className={`text-sm ${
              status === "error" ? "text-destructive" : status === "success" ? "text-emerald-600" : "text-muted-foreground"
            }`}
          >
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
