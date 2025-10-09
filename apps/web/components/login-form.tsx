"use client";

import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader } from "@ma/ui";
import { useState } from "react";

export const LoginForm = () => {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("success");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <Card className="max-w-md" data-testid="login-card">
      <CardHeader>
        <h2 className="text-xl font-semibold" data-testid="login-heading">
          Sign in
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your workspace.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="login-email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-testid="login-password"
            />
          </div>
          <Button
            className="w-full"
            type="submit"
            disabled={status === "loading"}
            data-testid="login-submit"
          >
            {status === "loading" ? "Signing in..." : "Sign in"}
          </Button>
          {message && (
            <p className="text-sm text-muted-foreground" role="status" data-testid="login-message">
              {message}
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            <Link className="underline" href="/auth/reset-password">
              Forgot your password?
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
};
