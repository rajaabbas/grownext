"use client";

import { useEffect, useState } from "react";
import { CreateTenantForm } from "./create-tenant-form";

interface AddTenantDialogProps {
  organizationId: string;
}

export function AddTenantDialog({ organizationId }: AddTenantDialogProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-200 transition hover:border-fuchsia-500 hover:text-fuchsia-100"
      >
        Add tenants
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Add tenant</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Provide a name and optional description for the new tenant workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                aria-label="Close add tenant dialog"
              >
                Close
              </button>
            </div>
            <CreateTenantForm organizationId={organizationId} onSuccess={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
