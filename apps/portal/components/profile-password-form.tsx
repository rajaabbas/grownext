"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { withRequestedWithHeader } from "@/lib/request-headers";

const minPasswordLength = 8;

export function ProfilePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (newPassword.length < minPasswordLength) {
      setError(`Password must be at least ${minPasswordLength} characters long.`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        "/api/profile/password",
        withRequestedWithHeader({
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ currentPassword, newPassword })
        })
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to update password");
      }

      setStatus("Password updated successfully. You will be asked to sign in again.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status ? <p className="text-sm text-emerald-400">{status}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <label className="block text-sm">
        <span className="text-slate-400">Current password</span>
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="••••••••"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-400">New password</span>
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="••••••••"
          minLength={minPasswordLength}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-400">Confirm new password</span>
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="••••••••"
          minLength={minPasswordLength}
          required
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Updating password..." : "Update password"}
      </button>
      <p className="text-xs text-slate-500">
        Password updates immediately revoke active sessions. You’ll be redirected to sign in again if necessary.
      </p>
    </form>
  );
}
