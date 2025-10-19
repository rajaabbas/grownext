"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { getSupabaseClient } from "@/lib/supabase/client";

const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://portal.grownext.dev";

export default function SignInPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (signInException) {
      setError((signInException as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6 py-10">
      <div className="w-full space-y-6 rounded-xl border border-border bg-card p-8 shadow-lg">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary/80">GrowNext</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Super Admin Sign-In</h1>
          <p className="text-sm text-muted-foreground">
            Use your Super Admin credentials. Contact the platform team to enable MFA or configure SSO for your account.
          </p>
        </header>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-foreground">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </label>

          {error ? <p className="text-sm text-destructive">Sign-in failed: {error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Need help? Review the{" "}
            <Link href="/docs/plan" className="font-medium text-primary underline">
              delivery plan
            </Link>{" "}
            or reach out in #platform-support.
          </p>
          <p>
            Prefer SSO? Launch the{" "}
            <Link href={portalUrl} className="font-medium text-primary underline" target="_blank" rel="noreferrer">
              identity portal
            </Link>{" "}
            and return once authenticated.
          </p>
        </div>
      </div>
    </main>
  );
}
