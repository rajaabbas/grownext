"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

const LoginReasonBanner = () => {
  const searchParams = useSearchParams();
  const reason = searchParams?.get("reason") ?? null;

  if (!reason) {
    return null;
  }

  if (reason === "expired") {
    return (
      <p className="text-sm text-amber-400">
        Your previous session expired. Please sign in again to continue.
      </p>
    );
  }

  if (reason === "organization-activated") {
    return (
      <p className="text-sm text-emerald-400">Your organization is ready. Sign in again to continue.</p>
    );
  }

  return null;
};

export default function LoginPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const ensureFreshSession = async (attempt = 0): Promise<void> => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (!sessionData.session) {
          setInitializing(false);
          setInitialError(null);
          return;
        }

        let userResponse = await supabase.auth.getUser();

        if (userResponse.error || !userResponse.data?.user) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error("Failed to refresh session while validating login", refreshError);
          }

          userResponse = await supabase.auth.getUser();
        }

        if (cancelled) {
          return;
        }

        if (userResponse.error || !userResponse.data?.user) {
          await supabase.auth.signOut();
          setInitializing(false);
          setInitialError(null);
          return;
        }

        const organizationResponse = await fetch("/api/organization", {
          method: "GET",
          headers: { "Cache-Control": "no-store" }
        }).catch(() => null);

        if (cancelled) {
          return;
        }

        if (!organizationResponse) {
          setInitialError("Unable to verify your organization. Please try again.");
          setInitializing(false);
          return;
        }

        if (organizationResponse.ok) {
          setInitialError(null);
          setInitializing(false);
          router.replace("/");
          return;
        }

        if (organizationResponse.status === 404 || organizationResponse.status === 400) {
          if (attempt < 12) {
            setInitialError("Your workspace is still provisioning. Holding here and retrying…");
            setInitializing(true);
            await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
            if (cancelled) {
              return;
            }
            await ensureFreshSession(attempt + 1);
            return;
          }

          setInitialError(
            "We couldn't find an organization for your account. Create a new organization to continue."
          );
          setInitializing(false);
          router.replace("/auth/recover-workspace");
          return;
        }

        if (organizationResponse.status === 401) {
          setInitialError(null);
          setInitializing(false);
          router.replace("/auth/recover-workspace");
          return;
        }

        const detail = await organizationResponse.json().catch(() => null);
        if (detail?.error === "organization_context_missing") {
          setInitialError(null);
          setInitializing(false);
          router.replace("/auth/recover-workspace");
          return;
        }
        setInitialError(
          typeof detail?.message === "string"
            ? detail.message
            : typeof detail?.error === "string"
              ? detail.error
              : "We ran into an issue while verifying your organization. Please try again."
        );
        setInitializing(false);
      } catch {
        if (cancelled) {
          return;
        }

        await supabase.auth.signOut();
        setInitializing(false);
        setInitialError(null);
      }
    };

    void ensureFreshSession();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/");
  };

  useEffect(() => {
    if (!showReset) {
      setResetStatus(null);
      setResetError(null);
      setResetLoading(false);
    }
  }, [showReset]);

  useEffect(() => {
    if (showReset && !resetEmail && email) {
      setResetEmail(email);
    }
  }, [showReset, email, resetEmail]);

  const resetRedirectUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/auth/reset-password`;
  }, []);

  const handlePasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetEmail) {
      setResetError("Enter the email associated with your account.");
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetStatus(null);

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: resetRedirectUrl ?? undefined
      });

      if (resetErr) {
        setResetError(resetErr.message);
        return;
      }

      setResetStatus("Password reset email sent. Check your inbox for further instructions.");
    } catch (err) {
      setResetError((err as Error).message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Sign in to GrowNext</h1>
        <Suspense fallback={null}>
          <LoginReasonBanner />
        </Suspense>
        <p className="text-sm text-slate-400">
          Enter your Supabase credentials to continue. Access tokens are exchanged with the identity service using PKCE.
        </p>
      </header>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6"
      >
        {initializing ? (
          <p className="text-sm text-slate-400">Checking your session…</p>
        ) : null}
        {initialError ? <p className="text-sm text-amber-400">{initialError}</p> : null}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <label className="block text-sm">
          <span className="text-slate-400">Email address</span>
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="demo@tenant.io"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading || initializing}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading || initializing}
            required
          />
        </label>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Use the credentials from your Supabase-managed account.</span>
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-fuchsia-300 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
          disabled={loading || initializing}
        >
          {loading ? "Signing in..." : "Continue"}
        </button>
        <p className="text-xs text-slate-500">
          Need an account? <Link href="/signup" className="text-fuchsia-300 hover:underline">Create one</Link>.
        </p>
      </form>
      {showReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="mx-4 w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Reset password</h2>
                <p className="text-sm text-slate-400">
                  Enter your email and we&apos;ll send instructions to reset your password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              >
                Close
              </button>
            </div>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              {resetStatus ? <p className="text-sm text-emerald-400">{resetStatus}</p> : null}
              {resetError ? <p className="text-sm text-red-400">{resetError}</p> : null}
              <label className="flex flex-col gap-2 text-sm text-slate-200">
                <span>Email address</span>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                  placeholder="you@example.com"
                  required
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-md border border-fuchsia-500/40 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-500 hover:text-white disabled:opacity-50"
                disabled={resetLoading}
              >
                {resetLoading ? "Sending reset email..." : "Send reset link"}
              </button>
            </form>
            <p className="text-xs text-slate-500">
              We&apos;ll send you an email with a secure link to choose a new password. The link is valid for 1 hour.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
