"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/");
      }
    });
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

  return (
    <div className="mx-auto max-w-lg space-y-6 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Sign in to GrowNext</h1>
        <p className="text-sm text-slate-400">
          Enter your Supabase credentials to continue. Access tokens are exchanged with the identity service using PKCE.
        </p>
      </header>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <label className="block text-sm">
          <span className="text-slate-400">Email address</span>
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="demo@tenant.io"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
            required
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Continue"}
        </button>
        <p className="text-xs text-slate-500">
          Need an account? <Link href="/signup" className="text-fuchsia-300 hover:underline">Create one</Link>.
        </p>
      </form>
    </div>
  );
}
