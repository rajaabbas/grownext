"use client";

import { useMemo, useState } from "react";

type PermissionScope = "organization" | "members" | "tenant" | "identity" | "permissions";

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  inherited?: boolean;
  portalPermissions: Record<PermissionScope, string[]>;
}

interface PermissionsManagerProps {
  initialRoles: RoleDefinition[];
  canModify?: boolean;
}

interface PermissionCatalogEntry {
  label: string;
  value: string;
  description: string;
}

const permissionCatalog: Record<PermissionScope, PermissionCatalogEntry[]> = {
  organization: [
    {
      label: "View organization profile",
      value: "organization:view",
      description: "Access organization settings and high-level details."
    },
    {
      label: "Manage organization profile",
      value: "organization:update",
      description: "Rename the organization and update metadata."
    },
    {
      label: "Manage billing & plans",
      value: "organization:billing",
      description: "Upgrade plans and manage billing contacts."
    },
    {
      label: "Delete organization",
      value: "organization:delete",
      description: "Permanently delete the organization and all tenants."
    }
  ],
  members: [
    {
      label: "View organization members",
      value: "members:view",
      description: "See the member directory and role assignments."
    },
    {
      label: "Invite new members",
      value: "members:invite",
      description: "Send invitations and approve join requests."
    },
    {
      label: "Edit or remove members",
      value: "members:manage",
      description: "Change member roles or remove users from the organization."
    }
  ],
  tenant: [
    {
      label: "View tenants",
      value: "tenant:view",
      description: "Access tenant dashboards and metadata in read-only mode."
    },
    {
      label: "Create new tenants",
      value: "tenant:create",
      description: "Provision new tenant workspaces inside the organization."
    },
    {
      label: "Manage tenant settings",
      value: "tenant:update",
      description: "Rename tenants and adjust tenant metadata."
    },
    {
      label: "Manage tenant membership",
      value: "tenant:members",
      description: "Add or remove members from specific tenants."
    },
    {
      label: "Enable tenant applications",
      value: "tenant:apps",
      description: "Link products and applications to tenants."
    }
  ],
  identity: [
    {
      label: "View identity configuration",
      value: "identity:read",
      description: "View identity issuer, JWKS and OAuth configuration."
    },
    {
      label: "Manage identity providers",
      value: "identity:providers",
      description: "Configure external IdP connections and credentials."
    },
    {
      label: "Access audit events",
      value: "identity:audit",
      description: "Review authentication and authorization audit feeds."
    }
  ],
  permissions: [
    {
      label: "View role definitions",
      value: "permissions:view",
      description: "Open the permissions catalog and review role capabilities."
    },
    {
      label: "Modify role permissions",
      value: "permissions:modify",
      description: "Create, edit, or delete roles and their permission sets."
    }
  ]
};

const defaultPortalRoleId = () => crypto.randomUUID();

export function PermissionsManager({ initialRoles, canModify = true }: PermissionsManagerProps) {
  const [roles, setRoles] = useState<RoleDefinition[]>(() =>
    initialRoles.map((role) => ({
      ...role,
      portalPermissions: {
        organization: [...(role.portalPermissions.organization ?? [])],
        members: [...(role.portalPermissions.members ?? [])],
        tenant: [...(role.portalPermissions.tenant ?? [])],
        identity: [...(role.portalPermissions.identity ?? [])],
        permissions: [...(role.portalPermissions.permissions ?? [])]
      }
    }))
  );
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const addRole = () => {
    if (!canModify) return;
    setFormError(null);
    const trimmedName = newRoleName.trim();
    if (!trimmedName) {
      setFormError("Provide a role name.");
      return;
    }
    if (roles.some((role) => role.name.toLowerCase() === trimmedName.toLowerCase())) {
      setFormError("A role with this name already exists.");
      return;
    }

    setRoles((prev) => [
      ...prev,
      {
        id: defaultPortalRoleId(),
        name: trimmedName,
        description: newRoleDescription.trim() || "Custom role",
        portalPermissions: {
          organization: [],
          members: [],
          tenant: [],
          identity: [],
          permissions: []
        }
      }
    ]);
    setNewRoleName("");
    setNewRoleDescription("");
  };

  const togglePermission = (roleId: string, scope: PermissionScope, value: string) => {
    if (!canModify) return;
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id !== roleId) return role;
        const current = new Set(role.portalPermissions[scope] ?? []);
        if (current.has(value)) {
          current.delete(value);
        } else {
          current.add(value);
        }
        return {
          ...role,
          portalPermissions: {
            ...role.portalPermissions,
            [scope]: Array.from(current).sort()
          }
        };
      })
    );
  };

  const removeRole = (roleId: string) => {
    if (!canModify) return;
    setRoles((prev) => prev.filter((role) => role.id !== roleId));
  };

  const summary = useMemo(
    () =>
      roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        counts: {
          organization: role.portalPermissions.organization.length,
          members: role.portalPermissions.members.length,
          tenant: role.portalPermissions.tenant.length,
          identity: role.portalPermissions.identity.length,
          permissions: role.portalPermissions.permissions.length
        },
        inherited: role.inherited ?? false
      })),
    [roles]
  );

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-white">Defined roles</h2>
        <p className="mt-2 text-sm text-slate-400">
          Roles govern what members can do in the identity portal. Owners and admins can refine
          permissions or create custom roles for specialized teams.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {summary.map((role) => (
            <article
              key={role.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-white">{role.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">{role.description}</p>
                </div>
                {!role.inherited ? (
                  <button
                    type="button"
                    onClick={() => removeRole(role.id)}
                    className="text-xs text-slate-500 transition hover:text-red-400 disabled:opacity-40"
                    disabled={!canModify}
                  >
                    Remove
                  </button>
                ) : (
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-500">
                    Managed
                  </span>
                )}
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
        <h2 className="text-lg font-semibold text-white">Add a custom role</h2>
        <div className="mt-4 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-sm text-slate-400">
            Create specialized roles for regional admins, read-only reviewers, or onboarding teams.
            Permissions apply across all tenants unless otherwise noted.
          </p>
          {!canModify ? (
            <p className="text-xs text-slate-500">
              You have read-only access to the role catalog. Ask an organization administrator for the
              <code> permissions:modify </code>
              permission to adjust these settings.
            </p>
          ) : null}
         <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              Role name
              <input
                type="text"
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
                placeholder="e.g. Support Manager"
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-fuchsia-500 focus:outline-none"
                disabled={!canModify}
              />
            </label>
            <label className="text-sm text-slate-300">
              Description
              <input
                type="text"
                value={newRoleDescription}
                onChange={(event) => setNewRoleDescription(event.target.value)}
                placeholder="Optional context for the team"
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-fuchsia-500 focus:outline-none"
                disabled={!canModify}
              />
            </label>
          </div>
          {formError ? <p className="text-sm text-red-400">{formError}</p> : null}
          <button
            type="button"
            onClick={addRole}
            className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-200 transition hover:border-fuchsia-500 hover:text-white"
            disabled={!canModify}
          >
            Add role
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Configure permissions</h2>
        <p className="mt-2 text-sm text-slate-400">
          Toggle the permissions each role should inherit. Identity and portal changes take effect
          immediately for members assigned these roles.
        </p>
        <div className="mt-6 space-y-6">
          {roles.map((role) => (
            <details
              key={role.id}
              className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-white">
                <span>{role.name}</span>
                <span className="text-xs text-slate-500">
                  {role.portalPermissions.organization.length +
                    role.portalPermissions.members.length +
                    role.portalPermissions.tenant.length +
                    role.portalPermissions.identity.length +
                    role.portalPermissions.permissions.length}{" "}
                  permissions
                </span>
              </summary>
              <div className="space-y-6 px-5 pb-6">
                {(Object.keys(permissionCatalog) as PermissionScope[]).map((scope) => (
                  <div key={scope} className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-200 capitalize">{scope}</h3>
                    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                      {permissionCatalog[scope].map((permission) => {
                        const checked = role.portalPermissions[scope]?.includes(permission.value);
                        return (
                          <label
                            key={permission.value}
                            className={`flex items-start gap-3 rounded-lg border border-transparent p-3 transition ${
                              canModify
                                ? "cursor-pointer hover:border-fuchsia-500/40 hover:bg-slate-900/60"
                                : "cursor-not-allowed opacity-70"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-fuchsia-500 focus:ring-fuchsia-500"
                              checked={checked}
                              onChange={() => togglePermission(role.id, scope, permission.value)}
                              disabled={!canModify}
                            />
                            <span>
                              <span className="block text-sm font-medium text-white">
                                {permission.label}
                              </span>
                              <span className="mt-1 block text-xs text-slate-400">
                                {permission.description}
                              </span>
                            </span>
                          </label>
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
