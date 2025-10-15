"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";

const ORGANIZATION_ROLES = [
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
  { value: "MEMBER", label: "Member" }
];

interface InviteMemberDialogProps {
  organizationId: string;
  canInvite?: boolean;
}

interface InvitationResult {
  invitationId: string;
  email: string;
  token?: string;
}

export function InviteMemberDialog({ organizationId, canInvite = true }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [, startTransition] = useTransition();

  const activationLink = useMemo(() => {
    if (!result?.token) {
      return null;
    }
    if (typeof window === "undefined") {
      return null;
    }
    return `${window.location.origin}/auth/invite?token=${result.token}`;
  }, [result]);

  const closeDialog = () => {
    setOpen(false);
    setError(null);
    setResult(null);
    setSubmitting(false);
    setEmail("");
    setRole("MEMBER");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/members/invitations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              organizationId,
              email,
              role
            })
          });

          if (!response.ok) {
            const json = await response.json().catch(() => null);
            if (response.status === 409) {
              throw new Error("An invitation has already been sent to that email.");
            }
            throw new Error(json?.message ?? json?.error ?? "Failed to create invitation");
          }

          const json = (await response.json()) as {
            invitation: { id: string; email: string };
            token?: string;
          };

          setResult({
            invitationId: json.invitation.id,
            email: json.invitation.email,
            token: json.token
          });
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setSubmitting(false);
        }
      })();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canInvite) {
            setOpen(true);
          }
        }}
        disabled={!canInvite}
        className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
          canInvite
            ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 hover:border-fuchsia-500 hover:text-fuchsia-100"
            : "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500"
        }`}
      >
        Invite member
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="mx-4 w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Invite member</h2>
                <p className="text-sm text-slate-400">Send an invitation to join the organization.</p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="flex flex-col gap-2 text-sm text-slate-200">
                <span>Email address</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                  placeholder="teammate@example.com"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-200">
                <span>Organization role</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                >
                  {ORGANIZATION_ROLES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="w-full rounded-md border border-fuchsia-500/40 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-500 hover:text-white disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Send invitation"}
              </button>
            </form>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {result && !error ? (
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <p>
                  Invitation sent to <span className="font-medium text-white">{result.email}</span>.
                </p>
                <p className="text-xs text-slate-500">
                  The invite link has been emailed to the user. You can also copy the activation link below.
                </p>
                {activationLink ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate-500">Activation link</span>
                      <p className="mt-1 break-all text-xs text-slate-300">{activationLink}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
