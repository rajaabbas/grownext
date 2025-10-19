"use client";

import { useEffect, useMemo, useState } from "react";
import type { SuperAdminEntitlement, SuperAdminOrganizationDetail, SuperAdminProductRole } from "@ma/contracts";
import clsx from "clsx";

interface UserEntitlementsCardProps {
  entitlements: SuperAdminEntitlement[];
  organizations?: SuperAdminOrganizationDetail[];
  disabled?: boolean;
  pendingKey?: string | null;
  onGrant?: (input: {
    organizationId: string;
    tenantId: string;
    productId: string;
    roles: SuperAdminProductRole[];
    expiresAt?: string | undefined;
  }) => void;
  onRevoke?: (entitlement: SuperAdminEntitlement) => void;
}

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    dateStyle: "medium"
  });
};

export const UserEntitlementsCard = ({
  entitlements,
  organizations = [],
  disabled = false,
  pendingKey = null,
  onGrant,
  onRevoke
}: UserEntitlementsCardProps) => {
  const [organizationId, setOrganizationId] = useState<string>(organizations[0]?.id ?? "");
  const [tenantId, setTenantId] = useState<string>(organizations[0]?.tenants[0]?.id ?? "");
  const [productId, setProductId] = useState<string>("");
  const [role, setRole] = useState<SuperAdminProductRole>("MEMBER");
  const [expiresAt, setExpiresAt] = useState<string>("");

  useEffect(() => {
    if (!organizationId && organizations.length > 0) {
      setOrganizationId(organizations[0]!.id);
      setTenantId(organizations[0]!.tenants[0]?.id ?? "");
    }
  }, [organizations, organizationId]);

  useEffect(() => {
    const org = organizations.find((candidate) => candidate.id === organizationId);
    if (org && org.tenants.length > 0) {
      if (!org.tenants.some((tenant) => tenant.id === tenantId)) {
        setTenantId(org.tenants[0]!.id);
      }
    } else {
      setTenantId("");
    }
  }, [organizationId, organizations]);

  const tenantOptions = useMemo(() => {
    return organizations.find((candidate) => candidate.id === organizationId)?.tenants ?? [];
  }, [organizationId, organizations]);

  const isGrantDisabled =
    disabled ||
    pendingKey === "entitlement-grant" ||
    !organizationId ||
    !tenantId ||
    productId.trim().length === 0;

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Product access</h3>
        <p className="text-sm text-muted-foreground">
          Review which products and tenants the user can access. Role mapping will inform impersonation scopes and
          support privileges.
        </p>
      </header>
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">
                Product
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Tenant
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Roles
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Granted
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Expires
              </th>
              {onRevoke ? (
                <th scope="col" className="px-4 py-3 text-right">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {entitlements.length === 0 ? (
              <tr>
                <td colSpan={onRevoke ? 6 : 5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No product entitlements have been granted to this user yet.
                </td>
              </tr>
            ) : (
              entitlements.map((entitlement) => (
                <tr key={entitlement.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{entitlement.productName}</div>
                    <div className="text-xs uppercase text-muted-foreground">{entitlement.productSlug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-foreground">{entitlement.tenantName ?? "Tenant unavailable"}</div>
                    <div className="text-xs text-muted-foreground">{entitlement.tenantId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                      {entitlement.roles.map((role) => (
                        <span key={`${entitlement.id}-${role}`} className="rounded-full border border-border px-2 py-0.5">
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(entitlement.createdAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(entitlement.expiresAt)}</td>
                  {onRevoke ? (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onRevoke(entitlement)}
                        disabled={disabled || pendingKey === `entitlement-revoke-${entitlement.id}`}
                        className={clsx(
                          "rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition",
                          "hover:border-destructive hover:text-destructive",
                          disabled || pendingKey === `entitlement-revoke-${entitlement.id}`
                            ? "cursor-not-allowed opacity-60"
                            : ""
                        )}
                      >
                        Revoke
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onGrant ? (
        <form
          className="mt-6 grid gap-4 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (isGrantDisabled) return;
            onGrant({
              organizationId,
              tenantId,
              productId: productId.trim(),
              roles: [role],
              expiresAt: expiresAt.trim() ? new Date(expiresAt).toISOString() : undefined
            });
          }}
        >
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Organization</span>
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                disabled={disabled || pendingKey === "entitlement-grant" || organizations.length === 0}
              >
                <option value="" disabled>
                  Select organization
                </option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Tenant</span>
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
                disabled={disabled || pendingKey === "entitlement-grant" || tenantOptions.length === 0}
              >
                <option value="" disabled>
                  {tenantOptions.length === 0 ? "No tenants" : "Select tenant"}
                </option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Product ID</span>
              <input
                type="text"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                placeholder="prod_..."
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                disabled={disabled || pendingKey === "entitlement-grant"}
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Role</span>
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={role}
                onChange={(event) => setRole(event.target.value as SuperAdminProductRole)}
                disabled={disabled || pendingKey === "entitlement-grant"}
              >
                {PRODUCT_ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Expires at (optional)</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={disabled || pendingKey === "entitlement-grant"}
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isGrantDisabled}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add entitlement
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
};

const PRODUCT_ROLE_OPTIONS: SuperAdminProductRole[] = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "VIEWER",
  "ANALYST",
  "CONTRIBUTOR",
  "MEMBER"
];
