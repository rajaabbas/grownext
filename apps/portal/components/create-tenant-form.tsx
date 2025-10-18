"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { withRequestedWithHeader } from "@/lib/request-headers";

interface CreateTenantFormProps {
  organizationId: string;
  onSuccess?: () => void;
}

export function CreateTenantForm({ organizationId, onSuccess }: CreateTenantFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/tenants",
        withRequestedWithHeader({
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            organizationId,
            name,
            description: description.length > 0 ? description : undefined
          })
        })
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.message ?? json?.error ?? "Failed to create tenant");
      }

      setName("");
      setDescription("");
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
      {error && <p className="md:col-span-2 text-sm text-red-400">{error}</p>}
      <label className="flex flex-col text-sm">
        <span className="text-slate-400">Tenant name</span>
        <input
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          placeholder="Payments"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label className="flex flex-col text-sm">
        <span className="text-slate-400">Description</span>
        <input
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
          placeholder="Payment services"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className="md:col-span-2 rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
        disabled={submitting}
      >
        {submitting ? "Provisioning tenant..." : "Provision tenant"}
      </button>
    </form>
  );
}
