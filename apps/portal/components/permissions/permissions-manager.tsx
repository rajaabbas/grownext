"use client";

import { useMemo, useState } from "react";
import {
  partitionPermissionsByScope,
  permissionCatalog,
  type PermissionScope
} from "@/lib/portal-permission-catalog";
import { PortalRolePermissionsSchema, type PortalPermission } from "@ma/contracts";

export interface RoleDefinition {
  role: string;
  name: string;
  description: string;
  inherited?: boolean;
  portalPermissions: Record<PermissionScope, PortalPermission[]>;
}

interface PermissionsManagerProps {
  initialRoles: RoleDefinition[];
  canModify?: boolean;
}

const flattenPermissions = (definition: RoleDefinition): PortalPermission[] => {
  const combined: PortalPermission[] = [];
  combined.push(...definition.portalPermissions.organization);
  combined.push(...definition.portalPermissions.members);
  combined.push(...definition.portalPermissions.tenant);
  combined.push(...definition.portalPermissions.identity);
  combined.push(...definition.portalPermissions.permissions);
  return Array.from(new Set(combined)).sort();
};

export function PermissionsManager({ initialRoles, canModify = true }: PermissionsManagerProps) {
  const [roles, setRoles] = useState<RoleDefinition[]>(() =>
    initialRoles.map((role) => ({
      ...role,
      portalPermissions: {
        organization: role.portalPermissions.organization.slice(),
        members: role.portalPermissions.members.slice(),
        tenant: role.portalPermissions.tenant.slice(),
        identity: role.portalPermissions.identity.slice(),
        permissions: role.portalPermissions.permissions.slice()
      }
    }))
  );
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleToggle = async (
    roleName: string,
    scope: PermissionScope,
    permission: PortalPermission
  ) => {
    if (!canModify) return;

    setSaveError(null);

    const previous = roles;
    let updatedRole: RoleDefinition | null = null;

    const next = roles.map((role) => {
      if (role.role !== roleName) return role;
      const current = new Set(role.portalPermissions[scope]);
      if (current.has(permission)) {
        current.delete(permission);
      } else {
        current.add(permission);
      }
      const portalPermissions = {
        ...role.portalPermissions,
        [scope]: Array.from(current).sort()
      } as RoleDefinition["portalPermissions"];
      updatedRole = {
        ...role,
        portalPermissions
      };
      return updatedRole;
    });

    if (!updatedRole) return;

    setRoles(next);
    setSavingRole(roleName);

    try {
      const response = await fetch(`/api/permissions/${encodeURIComponent(roleName)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: flattenPermissions(updatedRole) })
      });

      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }

      const payload = await response.json();
      const parsed = PortalRolePermissionsSchema.parse(payload);

      setRoles((current) =>
        current.map((role) =>
          role.role === parsed.role
            ? {
                ...role,
                portalPermissions: partitionPermissionsByScope(parsed.permissions)
              }
            : role
        )
      );
    } catch (error) {
      console.error("Failed to update portal permissions", error);
      setRoles(previous);
      setSaveError("Failed to update permissions. Please try again.");
    } finally {
      setSavingRole(null);
    }
  };

  const summary = useMemo(
    () =>
      roles.map((role) => ({
        role: role.role,
        name: role.name,
        description: role.description,
        inherited: role.inherited ?? false,
        counts: {
          organization: role.portalPermissions.organization.length,
          members: role.portalPermissions.members.length,
          tenant: role.portalPermissions.tenant.length,
          identity: role.portalPermissions.identity.length,
          permissions: role.portalPermissions.permissions.length
        }
      })),
    [roles]
  );

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-white">Defined roles</h2>
        <p className="mt-2 text-sm text-slate-400">
          Roles govern what members can do in the identity portal. Owners and admins can refine
          permissions for each organization role.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {summary.map((role) => (
            <article
              key={role.role}
              className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{role.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">{role.description}</p>
                </div>
                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-500">
                  {role.inherited ? "Managed" : "Custom"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-slate-700 px-2 py-0.5">
                  {role.counts.organization} organization permissions
                </span>
                <span className="rounded-full border border-slate-700 px-2 py-0.5">
                  {role.counts.members} member permissions
                </span>
                <span className="rounded-full border border-slate-700 px-2 py-0.5">
                  {role.counts.tenant} tenant permissions
                </span>
                <span className="rounded-full border border-slate-700 px-2 py-0.5">
                  {role.counts.identity} identity permissions
                </span>
                <span className="rounded-full border border-slate-700 px-2 py-0.5">
                  {role.counts.permissions} permission-management rights
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Configure permissions</h2>
        <p className="mt-2 text-sm text-slate-400">
          Toggle the permissions each role should inherit. Updates save automatically.
        </p>
        {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}
        <div className="mt-6 space-y-6">
          {roles.map((role) => (
            <details
              key={role.role}
              className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60"
              open
            >
              <summary className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-white">
                <span>{role.name}</span>
                <span className="text-xs text-slate-500">
                  {role.portalPermissions.organization.length +
                    role.portalPermissions.members.length +
                    role.portalPermissions.tenant.length +
                    role.portalPermissions.identity.length +
                    role.portalPermissions.permissions.length}{" "}
                  permissions
                  {savingRole === role.role ? " • Saving…" : null}
                </span>
              </summary>
              <div className="space-y-6 px-5 pb-6">
                {(Object.keys(permissionCatalog) as PermissionScope[]).map((scope) => (
                  <div key={scope} className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-200 capitalize">{scope}</h3>
                    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                      {permissionCatalog[scope].map((entry) => {
                        const checked = role.portalPermissions[scope].includes(entry.value);
                        const disabled = !canModify || savingRole === role.role;
                        const inputId = `${role.role}-${scope}-${entry.value}`.replace(/[^a-zA-Z0-9_-]/g, "-");
                        return (
                          <div
                            key={entry.value}
                            className={`flex items-start gap-3 rounded-lg border border-transparent p-3 transition ${
                              disabled
                                ? "cursor-not-allowed opacity-70"
                                : "hover:border-fuchsia-500/40 hover:bg-slate-900/60"
                            }`}
                          >
                            <input
                              type="checkbox"
                              id={inputId}
                              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-fuchsia-500 focus:ring-fuchsia-500"
                              checked={checked}
                              onChange={() => handleToggle(role.role, scope, entry.value)}
                              disabled={disabled}
                            />
                            <label
                              htmlFor={inputId}
                              className={`flex-1 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <span className="block text-sm font-medium text-white">{entry.label}</span>
                              <span className="mt-1 block text-xs text-slate-400">{entry.description}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
