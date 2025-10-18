"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withRequestedWithHeader } from "@/lib/request-headers";

interface DeleteOrganizationButtonProps {
  organizationId: string;
  organizationName: string;
  disabled?: boolean;
}

export function DeleteOrganizationButton({
  organizationId,
  organizationName,
  disabled = false
}: DeleteOrganizationButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (disabled) return;
    const confirmation = window.confirm(
      `Delete ${organizationName}? This action removes all tenants, member access, and related data across connected apps. This cannot be undone.`
    );

    if (!confirmation) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          "/api/organization",
          withRequestedWithHeader({
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId })
          })
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message ?? payload?.error ?? `Request failed (${response.status})`);
        }

        router.push("/login");
        router.refresh();
      } catch (caught) {
        setError((caught as Error).message);
      }
    });
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleDelete}
        disabled={disabled || isPending}
        className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Deleting…" : "Delete organization"}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
