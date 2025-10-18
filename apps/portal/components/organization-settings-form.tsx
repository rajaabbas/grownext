"use client";

import { FormEvent, useEffect, useState } from "react";
import { withRequestedWithHeader } from "@/lib/request-headers";

interface OrganizationSettingsFormProps {
  organizationId: string;
  initialName: string;
  canEdit: boolean;
}

export function OrganizationSettingsForm({ organizationId, initialName, canEdit }: OrganizationSettingsFormProps) {
  const [savedName, setSavedName] = useState(initialName);
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setSavedName(initialName);
  }, [initialName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    setError(null);

    if (!canEdit) {
      setError("You do not have permission to rename the organization.");
      setLoading(false);
      return;
    }

    if (name.trim().length < 2) {
      setError("Organization name must be at least 2 characters.");
      setLoading(false);
      return;
    }

    if (name === savedName) {
      setStatus("No changes to save.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "/api/organization",
        withRequestedWithHeader({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ organizationId, name })
        })
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to update organization");
      }

      setStatus("Organization details updated.");
      setSavedName(name);
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
        <span className="text-slate-400">Organization name</span>
        <input
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="GrowNext Inc."
          required
          disabled={!canEdit}
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        disabled={loading || !canEdit}
      >
        {loading ? "Saving..." : "Update organization"}
      </button>
      {!canEdit ? (
        <p className="text-xs text-slate-500">
          Only organization owners or admins can rename the organization.
        </p>
      ) : null}
    </form>
  );
}
