"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { withRequestedWithHeader } from "@/lib/request-headers";

interface TenantMemberRow {
  id: string;
  organizationMemberId: string;
  role: string;
  organizationMember: {
    userId: string;
    role: string;
    user: {
      fullName: string;
      email: string;
    };
  };
}

interface OrganizationMemberSummary {
  id: string;
  userId: string;
  role: string;
  user: {
    fullName: string;
    email: string;
  };
}

interface AppProductMeta {
  id: string;
  name: string;
}

interface TenantMembersSectionProps {
  tenantId: string;
  organizationId: string;
  members: TenantMemberRow[];
  organizationMembers: OrganizationMemberSummary[];
  products: AppProductMeta[];
  enabledProductIds: string[];
  userEntitlements: Record<string, Record<string, { entitlementId: string; roles: string[] }>>;
  canManageMembers: boolean;
  canManageApps: boolean;
}

const TENANT_ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "MEMBER", label: "Member" }
];


export function TenantMembersSection({
  tenantId,
  organizationId,
  members,
  organizationMembers,
  products,
  enabledProductIds,
  userEntitlements,
  canManageMembers,
  canManageApps
}: TenantMembersSectionProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [permissionsMemberId, setPermissionsMemberId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("MEMBER");
  const [, startTransition] = useTransition();

  const availableMembers = useMemo(() => {
    const existingIds = new Set(members.map((member) => member.organizationMemberId));
    return organizationMembers.filter((member) => !existingIds.has(member.id));
  }, [members, organizationMembers]);

  const enabledProducts = useMemo(
    () => products.filter((product) => enabledProductIds.includes(product.id)),
    [products, enabledProductIds]
  );

  const resetFeedback = () => {
    setError(null);
    setStatus(null);
  };

  const submitAddMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageMembers) {
      setError("You do not have permission to add members to this tenant.");
      return;
    }
    if (!selectedMemberId) {
      return;
    }

    resetFeedback();
    setPendingMemberId(selectedMemberId);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/tenants/${tenantId}/members`,
            withRequestedWithHeader({
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                organizationMemberId: selectedMemberId,
                role: selectedRole
              })
            })
          );

          if (!response.ok) {
            const json = await response.json().catch(() => null);
            throw new Error(json?.message ?? json?.error ?? "Failed to add member");
          }

          setStatus("Member added");
          setAddDialogOpen(false);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setPendingMemberId(null);
        }
      })();
    });
  };

  const handleRemoveMember = (organizationMemberId: string) => {
    if (!canManageMembers) {
      setError("You do not have permission to remove members.");
      return;
    }
    resetFeedback();
    setPendingMemberId(organizationMemberId);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/tenants/${tenantId}/members/${organizationMemberId}`,
            withRequestedWithHeader({ method: "DELETE" })
          );

          if (!response.ok && response.status !== 204) {
            const json = await response.json().catch(() => null);
            throw new Error(json?.message ?? json?.error ?? "Failed to remove member");
          }

          setStatus("Member removed");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setPendingMemberId(null);
        }
      })();
    });
  };

  const handlePermissionToggle = (member: TenantMemberRow, productId: string, nextEnabled: boolean) => {
    if (!canManageApps) {
      setError("You do not have permission to modify app access.");
      return;
    }
    resetFeedback();
    const entitlementKey = `${member.organizationMember.userId}:${productId}`;
    setPendingMemberId(entitlementKey);

    const entitlement = userEntitlements[member.organizationMember.userId]?.[productId];

    startTransition(() => {
      void (async () => {
        try {
          if (nextEnabled) {
            const response = await fetch(
              `/api/tenants/${tenantId}/products`,
              withRequestedWithHeader({
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  organizationId,
                  productId,
                  userId: member.organizationMember.userId
                })
              })
            );

            if (!response.ok) {
              const json = await response.json().catch(() => null);
              throw new Error(json?.message ?? json?.error ?? "Failed to grant access");
            }
          } else if (entitlement) {
            const response = await fetch(
              `/api/tenants/${tenantId}/entitlements/${entitlement.entitlementId}`,
              withRequestedWithHeader({ method: "DELETE" })
            );

            if (!response.ok && response.status !== 204) {
              const json = await response.json().catch(() => null);
              throw new Error(json?.message ?? json?.error ?? "Failed to revoke access");
            }
          }

          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setPendingMemberId(null);
        }
      })();
    });
  };

  const handleRoleChange = (member: TenantMemberRow, nextRole: string) => {
    if (!canManageMembers) {
      setError("You do not have permission to change tenant roles.");
      return;
    }
    if (nextRole === member.role) {
      return;
    }

    resetFeedback();
    setPendingMemberId(member.organizationMemberId);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/tenants/${tenantId}/members/${member.organizationMemberId}`,
            withRequestedWithHeader({
              method: "PATCH",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ role: nextRole })
            })
          );

          if (!response.ok) {
            const json = await response.json().catch(() => null);
            throw new Error(json?.message ?? json?.error ?? "Failed to update member role");
          }

          setStatus("Member role updated");
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setPendingMemberId(null);
        }
      })();
    });
  };

  const renderPermissionsDialog = () => {
    if (!permissionsMemberId) {
      return null;
    }

    const member = members.find((item) => item.organizationMemberId === permissionsMemberId);
    if (!member) {
      return null;
    }

      const entitlementsForMember = userEntitlements[member.organizationMember.userId] ?? {};

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
        <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Permissions</h3>
              <p className="text-sm text-slate-400">
                Control app access for {member.organizationMember.user.fullName}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPermissionsMemberId(null)}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {enabledProducts.length === 0 ? (
              <p className="text-sm text-slate-500">No apps are enabled for this tenant.</p>
            ) : (
              enabledProducts.map((product) => {
                const existing = entitlementsForMember[product.id];
                const enabled = Boolean(existing);
                const isPending = pendingMemberId === `${member.organizationMember.userId}:${product.id}`;
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{product.name}</p>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Tenant role: {member.role}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePermissionToggle(member, product.id, !enabled)}
                      disabled={isPending || !canManageApps}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        enabled
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-700 bg-slate-900 text-slate-300"
                      } ${canManageApps ? "" : "opacity-60"}`}
                      data-testid={`tenant-member-permission-${member.organizationMember.userId}-${product.id}`}
                    >
                      {isPending ? "Updating..." : enabled ? "On" : "Off"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAddDialog = () => {
    if (!addDialogOpen || !canManageMembers) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
        <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Add tenant member</h3>
              <p className="text-sm text-slate-400">Select someone from your organization to add.</p>
            </div>
            <button
              type="button"
              onClick={() => setAddDialogOpen(false)}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              Close
            </button>
          </div>
          <form onSubmit={submitAddMember} className="mt-4 space-y-4">
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span>Select member</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                value={selectedMemberId}
                onChange={(event) => setSelectedMemberId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Choose a member
                </option>
                {availableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.user.fullName} · {member.user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              <span>Tenant role</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
              >
                {TENANT_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="w-full rounded-md border border-fuchsia-500/40 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-500 hover:text-white disabled:opacity-50"
              disabled={pendingMemberId !== null || availableMembers.length === 0}
            >
              {pendingMemberId ? "Adding..." : "Add member"}
            </button>
            {availableMembers.length === 0 && (
              <p className="text-xs text-slate-500">All organization members already belong to this tenant.</p>
            )}
          </form>
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Members</h2>
        <button
          type="button"
          onClick={() => {
            resetFeedback();
            setAddDialogOpen(true);
            if (availableMembers.length > 0) {
              setSelectedMemberId(availableMembers[0]!.id);
            } else {
              setSelectedMemberId("");
            }
          }}
          className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-200 transition hover:border-fuchsia-500 hover:text-fuchsia-100 disabled:opacity-50"
          disabled={!canManageMembers}
        >
          Add members
        </button>
      </header>
      {!canManageMembers ? (
        <p className="text-xs text-slate-500">
          You have read-only access to this tenant&apos;s membership. Contact an administrator to request additional permissions.
        </p>
      ) : null}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {status && !error && <p className="text-sm text-emerald-400">{status}</p>}
      {members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
          No members yet. Add someone from your organization to get started.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
              <tr>
              <th className="px-4 py-3 text-left font-medium">Member</th>
              <th className="px-4 py-3 text-left font-medium">Org role</th>
              <th className="px-4 py-3 text-left font-medium">Tenant role</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-slate-300">
            {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{member.organizationMember.user.fullName}</div>
                    <div className="text-xs text-slate-500">{member.organizationMember.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                    {member.organizationMember.role}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
                    <select
                      value={member.role}
                      onChange={(event) => handleRoleChange(member, event.target.value)}
                      disabled={pendingMemberId === member.organizationMemberId || !canManageMembers}
                      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                      aria-label={`Tenant role for ${member.organizationMember.user.fullName}`}
                    >
                      {TENANT_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          resetFeedback();
                          setPermissionsMemberId(member.organizationMemberId);
                        }}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-100 disabled:opacity-50"
                        disabled={!canManageApps}
                      >
                        Permissions
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.organizationMemberId)}
                        disabled={pendingMemberId === member.organizationMemberId || !canManageMembers}
                        className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-red-500 hover:text-red-200 disabled:opacity-50"
                      >
                        {pendingMemberId === member.organizationMemberId ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {renderAddDialog()}
      {renderPermissionsDialog()}
    </section>
  );
}
