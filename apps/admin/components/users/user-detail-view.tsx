"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  SuperAdminEntitlement,
  SuperAdminProductRole,
  SuperAdminUserDetail,
  SuperAdminUserStatus
} from "@ma/contracts";
import { SuperAdminUserDetailSchema } from "@ma/contracts";
import { UserAuditCard } from "./user-audit-card";
import { useTelemetry } from "@/components/providers/telemetry-provider";
import { UserEntitlementsCard } from "./user-entitlements-card";
import { UserOrganizationsCard } from "./user-organizations-card";
import { UserProfileSummary } from "./user-profile-summary";
import { UserSamlCard } from "./user-saml-card";
import { UserImpersonationCard } from "./user-impersonation-card";
import { UserGuidanceCard } from "./user-guidance-card";

const ORGANIZATION_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
const TENANT_ROLES = ["ADMIN", "MEMBER"] as const;
const USER_STATUSES: SuperAdminUserStatus[] = ["ACTIVE", "SUSPENDED", "DEACTIVATED", "INVITED"];

type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];
type TenantRole = (typeof TENANT_ROLES)[number];

interface UserDetailViewProps {
  initialDetail: SuperAdminUserDetail;
  canManageAccess?: boolean;
}

interface PendingState {
  key: string | null;
  message: string | null;
}

export const UserDetailView = ({ initialDetail, canManageAccess = true }: UserDetailViewProps) => {
  const [detail, setDetail] = useState<SuperAdminUserDetail>(initialDetail);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingState>({ key: null, message: null });
  const [isPending, startTransition] = useTransition();
  const telemetry = useTelemetry();
  const [statusForm, setStatusForm] = useState<{ status: SuperAdminUserStatus; reason: string }>({
    status: initialDetail.status,
    reason: ""
  });

  const runMutation = (
    key: string,
    request: () => Promise<Response>,
    onSuccess?: (detail: SuperAdminUserDetail) => void
  ) => {
    if (!canManageAccess) {
      return;
    }

    setPending({ key, message: null });
    startTransition(() => {
      void (async () => {
        try {
          const response = await request();
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error ?? "Request failed");
          }
          const payload = await response.json();
          const parsed = SuperAdminUserDetailSchema.parse(payload);
          setDetail(parsed);
          setError(null);
          onSuccess?.(parsed);
        } catch (mutationError) {
          setError((mutationError as Error).message);
          setPending((prev) => ({ ...prev, message: (mutationError as Error).message }));
        } finally {
          setPending((prev) => ({ ...prev, key: prev.key === key ? null : prev.key }));
        }
      })();
    });
  };

  useEffect(() => {
    setStatusForm((prev) => ({ ...prev, status: detail.status }));
  }, [detail.status]);

  const handleOrganizationRoleChange = (organizationId: string, role: OrganizationRole) => {
    if (!canManageAccess) {
      return;
    }

    runMutation(
      `org-${organizationId}`,
      () =>
        fetch(`/api/super-admin/users/${detail.id}/organizations/${organizationId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ role })
        }),
      () => {
        telemetry.recordEvent("organization_role_updated", {
          organizationId,
          role,
          userId: detail.id
        });
      }
    );
  };

  const handleTenantRoleChange = (organizationId: string, tenantId: string, role: TenantRole) => {
    if (!canManageAccess) {
      return;
    }

    runMutation(
      `tenant-${tenantId}`,
      () =>
        fetch(`/api/super-admin/users/${detail.id}/organizations/${organizationId}/tenants/${tenantId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ role })
        }),
      () => {
        telemetry.recordEvent("tenant_role_updated", {
          organizationId,
          tenantId,
          role,
          userId: detail.id
        });
      }
    );
  };

  const handleEntitlementGrant = (input: {
    organizationId: string;
    tenantId: string;
    productId: string;
    roles: SuperAdminProductRole[];
    expiresAt?: string;
  }) => {
    if (!canManageAccess) {
      return;
    }

    runMutation(
      "entitlement-grant",
      () =>
        fetch(`/api/super-admin/users/${detail.id}/entitlements`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(input)
        }),
      () => {
        telemetry.recordEvent("entitlement_granted", {
          ...input,
          userId: detail.id
        });
      }
    );
  };

  const handleEntitlementRevoke = (entitlement: SuperAdminEntitlement) => {
    if (!canManageAccess) {
      return;
    }

    runMutation(
      `entitlement-revoke-${entitlement.id}`,
      () =>
        fetch(`/api/super-admin/users/${detail.id}/entitlements`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            organizationId: entitlement.organizationId,
            tenantId: entitlement.tenantId,
            productId: entitlement.productId
          })
        }),
      () => {
        telemetry.recordEvent("entitlement_revoked", {
          organizationId: entitlement.organizationId,
          tenantId: entitlement.tenantId,
          productId: entitlement.productId,
          userId: detail.id
        });
      }
    );
  };

  const statusChanged = statusForm.status !== detail.status;
  const isStatusPending = pending.key === "status-update";
  const statusSubmitDisabled = !statusChanged || isStatusPending || isPending;

  const handleStatusSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageAccess || !statusChanged) {
      return;
    }

    const reason = statusForm.reason.trim();
    runMutation(
      "status-update",
      () =>
        fetch(`/api/super-admin/users/${detail.id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status: statusForm.status,
            ...(reason.length > 0 ? { reason } : {})
          })
        }),
      (updatedDetail) => {
        telemetry.recordEvent("user_status_updated", {
          userId: detail.id,
          previousStatus: detail.status,
          nextStatus: updatedDetail.status
        });
        setStatusForm({ status: updatedDetail.status, reason: "" });
      }
    );
  };

  return (
    <div className="space-y-6">
      {canManageAccess && error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Failed to apply changes: {error}
        </div>
      ) : null}

      <UserProfileSummary user={detail} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {canManageAccess ? (
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <header className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">Account status</h3>
                <p className="text-sm text-muted-foreground">
                  Adjust the user&rsquo;s access level across GrowNext systems. Changes propagate immediately and are logged in the audit trail.
                </p>
              </header>
              <form className="mt-4 space-y-4" onSubmit={handleStatusSubmit}>
                <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                  <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
                    Status
                    <select
                      value={statusForm.status}
                      onChange={(event) =>
                        setStatusForm((prev) => ({
                          ...prev,
                          status: event.target.value as SuperAdminUserStatus
                        }))
                      }
                      disabled={isStatusPending}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {USER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0) + status.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-muted-foreground">
                    Reason (optional)
                    <textarea
                      value={statusForm.reason}
                      onChange={(event) =>
                        setStatusForm((prev) => ({
                          ...prev,
                          reason: event.target.value
                        }))
                      }
                      disabled={isStatusPending}
                      placeholder="Reference the ticket or context for this change"
                      rows={3}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusForm({ status: detail.status, reason: "" })}
                    disabled={isStatusPending}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={statusSubmitDisabled}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStatusPending ? "Updating…" : "Update status"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {canManageAccess ? (
            <UserImpersonationCard userId={detail.id} userEmail={detail.email} userName={detail.fullName} />
          ) : null}

          {!canManageAccess ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              You have read-only access to this user. Contact a Super Admin if you need to request changes.
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <UserOrganizationsCard
              organizations={detail.organizations}
              organizationRoles={ORGANIZATION_ROLES}
              tenantRoles={TENANT_ROLES}
              pendingKey={pending.key}
              onUpdateOrganizationRole={canManageAccess ? handleOrganizationRoleChange : undefined}
              onUpdateTenantRole={canManageAccess ? handleTenantRoleChange : undefined}
              disabled={isPending}
            />
            <UserEntitlementsCard
              entitlements={detail.entitlements}
              organizations={detail.organizations}
              pendingKey={pending.key}
              disabled={isPending}
              onGrant={canManageAccess ? handleEntitlementGrant : undefined}
              onRevoke={canManageAccess ? handleEntitlementRevoke : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <UserAuditCard events={detail.auditEvents.slice(0, 10)} />
            <UserSamlCard samlAccounts={detail.samlAccounts} />
          </div>
        </div>

        <UserGuidanceCard auditEvents={detail.auditEvents} userEmail={detail.email} />
      </div>
    </div>
  );
};
