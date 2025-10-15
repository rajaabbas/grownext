"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

interface InviteOnboardingFormProps {
  email: string;
}

export function InviteOnboardingForm({ email }: InviteOnboardingFormProps) {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const resetRedirectUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/auth/reset-password`;
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    setError(null);

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: fullName ? { full_name: fullName } : undefined
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!data.session) {
        setStatus("Account created. Check your email to confirm and then sign in to accept the invitation.");
      } else {
        setStatus("Account created and signed in. Finishing setup...");
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async () => {
    setResetLoading(true);
    setResetError(null);
    setResetStatus(null);

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetRedirectUrl
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
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">Create your account</h3>
        <p className="text-xs text-slate-400">
          Set a password to finish joining. The invitation is bound to <span className="font-medium text-slate-200">{email}</span>.
        </p>
      </div>
      {status ? <p className="text-sm text-emerald-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs text-slate-300">
          <span className="text-slate-400">Full name</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="Your name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-300">
          <span className="text-slate-400">Password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-slate-300">
          <span className="text-slate-400">Confirm password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md border border-fuchsia-500/40 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-500 hover:text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
        <p>Already registered but forgot your password?</p>
        {resetStatus ? <p className="text-emerald-400">{resetStatus}</p> : null}
        {resetError ? <p className="text-red-400">{resetError}</p> : null}
        <button
          type="button"
          onClick={handleSendReset}
          className="w-full rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-fuchsia-500 hover:text-fuchsia-100 disabled:opacity-50"
          disabled={resetLoading}
        >
          {resetLoading ? "Sending reset link..." : "Email me a reset link"}
        </button>
      </div>
    </div>
  );
}
