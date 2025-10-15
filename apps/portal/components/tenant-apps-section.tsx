"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface AppProduct {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  launcherUrl: string | null;
}

interface AppEntitlement {
  entitlementId: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  roles: string[];
}

interface TenantAppsSectionProps {
  tenantId: string;
  products: AppProduct[];
  enabledProductIds: string[];
  entitlementsByProduct: Record<string, AppEntitlement[]>;
  canManageApps: boolean;
}

export function TenantAppsSection({
  tenantId,
  products,
  enabledProductIds,
  entitlementsByProduct,
  canManageApps
}: TenantAppsSectionProps) {
  const router = useRouter();
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabledSet, setEnabledSet] = useState(() => new Set(enabledProductIds));
  const [membersModalProductId, setMembersModalProductId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setEnabledSet(new Set(enabledProductIds));
  }, [enabledProductIds]);

  const handleToggle = (productId: string, nextEnabled: boolean) => {
    if (!canManageApps) {
      setError("You do not have permission to modify tenant applications.");
      return;
    }

    setError(null);
    setPendingProductId(productId);

    startTransition(() => {
      void (async () => {
        try {
          if (nextEnabled) {
            const response = await fetch(`/api/tenants/${tenantId}/apps`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ productId })
            });

            if (!response.ok) {
              const json = await response.json().catch(() => null);
              throw new Error(json?.message ?? json?.error ?? "Failed to enable app");
            }
          } else {
            const response = await fetch(`/api/tenants/${tenantId}/apps/${productId}`, {
              method: "DELETE"
            });

            if (!response.ok && response.status !== 204) {
              const json = await response.json().catch(() => null);
              throw new Error(json?.message ?? json?.error ?? "Failed to disable app");
            }
          }

          setEnabledSet((prev) => {
            const next = new Set(prev);
            if (nextEnabled) {
              next.add(productId);
            } else {
              next.delete(productId);
            }
            return next;
          });

          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setPendingProductId(null);
        }
      })();
    });
  };

  const sortedProducts = useMemo(() => products.slice().sort((a, b) => a.name.localeCompare(b.name)), [
    products
  ]);

  const productById = useMemo(() => {
    const map = new Map<string, AppProduct>();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const selectedProduct = membersModalProductId
    ? productById.get(membersModalProductId) ?? null
    : null;
  const selectedMembers = membersModalProductId ? entitlementsByProduct[membersModalProductId] ?? [] : [];

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Apps</h2>
      </header>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {sortedProducts.map((product) => {
          const enabled = enabledSet.has(product.id);
          const members = entitlementsByProduct[product.id] ?? [];
          const memberLabel = members.length === 1 ? "1 member" : `${members.length} members`;
          return (
            <div
              key={product.id}
              className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{product.name}</h3>
                  {product.description && (
                    <p className="mt-1 text-sm text-slate-400">{product.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(product.id, !enabled)}
                  disabled={pendingProductId === product.id || !canManageApps}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    enabled
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                      : "border-slate-700 bg-slate-900 text-slate-300"
                  } ${canManageApps ? "" : "opacity-60"}`}
                  data-testid={`tenant-app-toggle-${product.id}`}
                >
                  {pendingProductId === product.id
                    ? "Updating..."
                    : enabled
                      ? "On"
                      : "Off"}
                </button>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-400">
                <button
                  type="button"
                  onClick={() => setMembersModalProductId(product.id)}
                  className="rounded-md px-3 py-1 text-xs text-slate-300 transition hover:text-fuchsia-100 hover:underline"
                >
                  {memberLabel}
                </button>
                {enabled && product.launcherUrl ? (
                  <Link
                    href={`/tenants/${tenantId}/apps/${product.id}/open`}
                    prefetch={false}
                    className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-100"
                  >
                    Open app
                  </Link>
                ) : null}
              </div>
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-500">
                  No members currently have access to this app.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {membersModalProductId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
          <div className="mx-4 w-full max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Members with access{selectedProduct ? ` • ${selectedProduct.name}` : ""}
                </h3>
                <p className="text-sm text-slate-400">
                  Review the members currently entitled to this application.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMembersModalProductId(null)}
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
              >
                Close
              </button>
            </div>
            {selectedMembers.length > 0 ? (
              <ul className="space-y-2 text-sm text-slate-300">
                {selectedMembers.map((member) => (
                  <li
                    key={member.entitlementId}
                    className="flex flex-col rounded-lg border border-slate-800 bg-slate-950 p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-medium">{member.userName}</p>
                      {member.userEmail && (
                        <p className="text-xs text-slate-500">{member.userEmail}</p>
                      )}
                    </div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {member.roles.join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                No members currently have access to this app.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
