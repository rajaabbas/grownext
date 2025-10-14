"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface ProductOption {
  id: string;
  name: string;
}

interface EnableProductFormProps {
  tenantId: string;
  organizationId: string;
  productOptions: ProductOption[];
  assignedProductIds: string[];
  defaultRoles?: string[];
}

export function EnableProductForm({
  tenantId,
  organizationId,
  productOptions,
  assignedProductIds,
  defaultRoles = ["OWNER"]
}: EnableProductFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availableProducts = useMemo(
    () => productOptions.filter((option) => !assignedProductIds.includes(option.id)),
    [productOptions, assignedProductIds]
  );

  const [selectedProductId, setSelectedProductId] = useState<string>("");

  useEffect(() => {
    if (availableProducts.length > 0) {
      setSelectedProductId(availableProducts[0]!.id);
    } else {
      setSelectedProductId("");
    }
  }, [availableProducts]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProductId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/tenants/${tenantId}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          organizationId,
          productId: selectedProductId,
          roles: defaultRoles
        })
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.message ?? json?.error ?? "Failed to enable product");
      }

      setStatus("Product enabled");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (productOptions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-end text-xs text-slate-500">
        No products available
      </div>
    );
  }

  if (availableProducts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-end text-xs text-slate-500">
        All available products are enabled
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <select
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
          value={selectedProductId}
          onChange={(event) => setSelectedProductId(event.target.value)}
        >
          {availableProducts.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-emerald-500 hover:text-emerald-200 disabled:opacity-50"
          disabled={submitting || !selectedProductId}
        >
          {submitting ? "Enabling..." : "Enable product"}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {status && !error && <p className="text-xs text-emerald-400">{status}</p>}
    </div>
  );
}
