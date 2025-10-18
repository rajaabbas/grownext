"use client";

import { FormEvent, useEffect, useState } from "react";
import { withRequestedWithHeader } from "@/lib/request-headers";

interface ProfileAccountFormProps {
  initialFullName: string | null;
  initialEmail: string;
}

export function ProfileAccountForm({ initialFullName, initialEmail }: ProfileAccountFormProps) {
  const [savedFullName, setSavedFullName] = useState(initialFullName ?? "");
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(initialFullName ?? "");
    setSavedFullName(initialFullName ?? "");
  }, [initialFullName]);

  useEffect(() => {
    setEmail(initialEmail);
    setSavedEmail(initialEmail);
  }, [initialEmail]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    setError(null);

    const payload: Record<string, string> = {};

    if (fullName && fullName !== savedFullName) {
      payload.fullName = fullName;
    }

    if (email && email !== savedEmail) {
      payload.email = email;
    }

    if (Object.keys(payload).length === 0) {
      setStatus("No changes to save.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "/api/profile",
        withRequestedWithHeader({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        })
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to update profile");
      }

      setStatus("Profile updated successfully.");
      setSavedFullName(fullName);
      setSavedEmail(email);
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
        <span className="text-slate-400">Full name</span>
        <input
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Your name"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-400">Email address</span>
        <input
          type="email"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Saving changes..." : "Save changes"}
      </button>
      <p className="text-xs text-slate-500">
        Changing your email may require verification. Check your inbox for confirmation steps after saving.
      </p>
    </form>
  );
}
