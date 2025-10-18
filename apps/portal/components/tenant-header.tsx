"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withRequestedWithHeader } from "@/lib/request-headers";

interface TenantHeaderProps {
  tenant: {
    id: string;
    organizationId: string;
    name: string;
    slug: string | null;
    description: string | null;
  };
}

export function TenantHeader({ tenant }: TenantHeaderProps) {
  const router = useRouter();
  const [name, setName] = useState(tenant.name);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setName(tenant.name);
  }, [tenant.name]);

  const handleSave = () => {
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/tenants/${tenant.id}`,
            withRequestedWithHeader({
              method: "PATCH",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                name,
                description: tenant.description ?? null
              })
            })
          );

          if (!response.ok) {
            const json = await response.json().catch(() => null);
            throw new Error(json?.message ?? json?.error ?? "Failed to update tenant");
          }

          setStatus("Tenant updated");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setSaving(false);
        }
      })();
    });
  };

  const handleDelete = () => {
    setConfirmOpen(false);
    setDeleting(true);
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/tenants/${tenant.id}`,
            withRequestedWithHeader({ method: "DELETE" })
          );

          if (!response.ok && response.status !== 204) {
            const json = await response.json().catch(() => null);
            throw new Error(json?.message ?? json?.error ?? "Failed to delete tenant");
          }

          router.push("/");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setDeleting(false);
        }
      })();
    });
  };

  const hasChanges = name.trim() !== tenant.name.trim();

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="tenant-name">
              Tenant name
            </label>
            <input
              id="tenant-name"
              className="max-w-xl rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-lg font-semibold text-white focus:border-fuchsia-500 focus:outline-none"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="text-sm text-slate-400">
            <span className="font-medium text-slate-300">Slug:</span> {tenant.slug ?? tenant.id}
          </div>
          {tenant.description && <p className="text-sm text-slate-400">{tenant.description}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {status && !error && <p className="text-sm text-emerald-400">{status}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-200 transition hover:border-fuchsia-500 hover:text-fuchsia-100 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
            className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-500 hover:text-red-100 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete tenant"}
          </button>
        </div>
      </div>
      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="mx-4 w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-6">
            <h3 className="text-lg font-semibold text-white">Delete tenant</h3>
            <p className="text-sm text-slate-400">
              Deleting this tenant will remove all associated data, including app records like tasks. This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md border border-red-500 px-3 py-1 text-sm text-red-200 transition hover:border-red-400 hover:text-red-100"
              >
                Confirm delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
