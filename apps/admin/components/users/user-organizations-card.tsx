"use client";

import type { SuperAdminOrganizationDetail } from "@ma/contracts";
import Link from "next/link";

type OrganizationRole = "OWNER" | "ADMIN" | "MEMBER";
type TenantRole = "ADMIN" | "MEMBER";

interface UserOrganizationsCardProps {
  organizations: SuperAdminOrganizationDetail[];
  organizationRoles?: readonly OrganizationRole[];
  tenantRoles?: readonly TenantRole[];
  disabled?: boolean;
  pendingKey?: string | null;
  onUpdateOrganizationRole?: (organizationId: string, role: OrganizationRole) => void;
  onUpdateTenantRole?: (organizationId: string, tenantId: string, role: TenantRole) => void;
}

export const UserOrganizationsCard = ({
  organizations,
  organizationRoles = ["OWNER", "ADMIN", "MEMBER"],
  tenantRoles = ["ADMIN", "MEMBER"],
  disabled = false,
  pendingKey = null,
  onUpdateOrganizationRole,
  onUpdateTenantRole
}: UserOrganizationsCardProps) => {
  if (organizations.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Organizations</h3>
          <p className="text-sm text-muted-foreground">No organization memberships found for this user.</p>
        </header>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <header className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Organizations</h3>
        <p className="text-sm text-muted-foreground">
          Lists organization membership and related tenants. Tenant links are placeholders until tenant views ship.
        </p>
      </header>
      <ul className="mt-4 space-y-4">
        {organizations.map((org) => (
          <li key={org.id} className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {org.name}
                  {org.slug ? <span className="ml-2 text-xs text-muted-foreground">({org.slug})</span> : null}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Role: {org.role}</p>
              </div>
              <Link
                href={`/organizations/${org.id}`}
                aria-disabled
                className="text-xs font-medium text-primary underline underline-offset-4"
              >
                View organization
              </Link>
            </div>
            {onUpdateOrganizationRole ? (
              <div className="mt-3 text-xs text-muted-foreground">
                <label className="flex flex-col gap-1 font-medium">
                  Update role
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={org.role}
                    disabled={disabled || pendingKey === `org-${org.id}`}
                    onChange={(event) =>
                      onUpdateOrganizationRole(org.id, event.target.value as OrganizationRole)
                    }
                  >
                    {organizationRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <div className="mt-3 text-sm text-muted-foreground">
              {org.tenants.length === 0 ? (
                <p>No tenant memberships.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {org.tenants.map((tenant) => (
                    <div
                      key={tenant.id}
                      className="rounded-md border border-border/70 bg-background/70 px-3 py-2"
                    >
                      <div className="text-xs font-semibold text-foreground">{tenant.name}</div>
                      <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                        Current role: {tenant.role}
                      </div>
                      {onUpdateTenantRole ? (
                        <label className="mt-2 flex flex-col gap-1 text-[0.65rem] font-medium text-muted-foreground">
                          Update tenant role
                          <select
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                            value={tenant.role}
                            disabled={disabled || pendingKey === `tenant-${tenant.id}`}
                            onChange={(event) =>
                              onUpdateTenantRole(
                                org.id,
                                tenant.id,
                                event.target.value as TenantRole
                              )
                            }
                          >
                            {tenantRoles.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
