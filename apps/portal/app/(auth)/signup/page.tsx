"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { withRequestedWithHeader } from "@/lib/request-headers";

export default function SignupPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
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
    setStatus(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organization_name: organizationName
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setStatus("Check your email to confirm the account before continuing.");
      setLoading(false);
      return;
    }

    try {
      await fetch(
        "/api/onboarding/organization",
        withRequestedWithHeader({
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: organizationName,
            defaultTenantName: organizationName
          })
        })
      );
    } catch (err) {
      console.error("Failed to initialize organization", err);
    }

    router.push("/");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Create your platform account</h1>
        <p className="text-sm text-slate-400">
          Sign up with Supabase Auth. We will provision your organization and default tenant automatically.
        </p>
      </header>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {status && <p className="text-sm text-emerald-400">{status}</p>}
        <label className="block text-sm">
          <span className="text-slate-400">Full name</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="Ada Lovelace"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Organization name</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="GrowNext Inc."
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Work email</span>
          <input
            type="email"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="ada@grownext.com"
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
          {loading ? "Creating account..." : "Create account"}
        </button>
        <p className="text-xs text-slate-500">
          Already registered? <Link href="/login" className="text-fuchsia-300 hover:underline">Sign in</Link>.
        </p>
      </form>
    </div>
  );
}
