"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError("This reset link is invalid or has expired. Request a new password reset.");
      }
      setSessionReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
        setError(null);
      }
    });

    return () => {
      listener.subscription?.unsubscribe();
    };
  }, [supabase]);

  const emailFromParams = useMemo(() => {
    return searchParams?.get("email") ?? null;
  }, [searchParams]);

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sessionReady) {
      setError("Your reset session is still initializing. Please wait a moment and try again.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setStatus("Password updated successfully. You can now sign in with your new password.");
      await supabase.auth.signOut();
      setTimeout(() => {
        router.replace("/login");
      }, 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12 text-slate-100">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-slate-400">
          {emailFromParams
            ? `Resetting password for ${emailFromParams}`
            : "Reset your GrowNext portal password."}
        </p>
      </header>
      <form onSubmit={handleReset} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        {status ? <p className="text-sm text-emerald-400">{status}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <label className="block text-sm">
          <span className="text-slate-400">New password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Confirm password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Updating password..." : "Update password"}
        </button>
      </form>
      <p className="text-center text-xs text-slate-500">
        Remembered it? <Link href="/login" className="text-fuchsia-300 hover:underline">Back to sign in</Link>.
      </p>
    </main>
  );
}
