"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface InviteAcceptanceProps {
  token: string;
  redirectTo?: string;
}

export function InviteAcceptance({ token, redirectTo = "/" }: InviteAcceptanceProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleAccept = () => {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/members/invitations/accept", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ token })
          });

          if (!response.ok) {
            const json = await response.json().catch(() => null);
            throw new Error(json?.error ?? "Failed to accept invitation");
          }

          setSuccess(true);
          router.push(redirectTo);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        }
      })();
    });
  };

  if (success) {
    return (
      <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        Invitation accepted. Redirecting…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleAccept}
        disabled={pending}
        className="w-full rounded-md border border-fuchsia-500/40 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-500 hover:text-white disabled:opacity-50"
      >
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
