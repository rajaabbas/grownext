"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantContext } from "@/components/tenant-context";

interface TaskOwner {
  id: string;
  email: string | null;
  fullName: string | null;
}

interface ApiPolicy {
  id: string;
  tenantId: string;
  projectId: string | null;
  userId: string;
  canManage: boolean;
  canEdit: boolean;
  canComment: boolean;
  canAssign: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiProject {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  color: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PolicyFormState {
  userId: string;
  projectId: string | null;
  canManage: boolean;
  canEdit: boolean;
  canComment: boolean;
  canAssign: boolean;
}

interface PolicyDraft {
  userId: string;
  policyId: string | null;
  canManage: boolean;
  canEdit: boolean;
  canComment: boolean;
  canAssign: boolean;
  dirty: boolean;
}

interface Toast {
  id: number;
  message: string;
  variant: "success" | "error";
}

const initialFormState: PolicyFormState = {
  userId: "",
  projectId: null,
  canManage: false,
  canEdit: false,
  canComment: false,
  canAssign: false
};

const makeDefaultDraft = (userId: string): PolicyDraft => ({
  userId,
  policyId: null,
  canManage: false,
  canEdit: false,
  canComment: false,
  canAssign: false,
  dirty: false
});

const resolveProjectName = (projectId: string | null, projects: ApiProject[]): string => {
  if (!projectId) return "All Projects";
  const match = projects.find((project) => project.id === projectId);
  return match ? match.name : projectId;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const formatUserName = (user: TaskOwner | undefined, fallback: string) =>
  user?.fullName ?? user?.email ?? fallback;

type DraftKey = "canManage" | "canEdit" | "canComment" | "canAssign";

export default function PermissionsSettingsPage() {
  const { activeTenantId: tenantId, loading: tenantLoading } = useTenantContext();

  const [users, setUsers] = useState<TaskOwner[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [policies, setPolicies] = useState<ApiPolicy[]>([]);
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyDraft>>({});
  const [savingUsers, setSavingUsers] = useState<Record<string, boolean>>({});
  const [deletingPolicies, setDeletingPolicies] = useState<Record<string, boolean>>({});
  const [projectFormState, setProjectFormState] = useState<PolicyFormState>(initialFormState);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [creatingOverride, setCreatingOverride] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const headersWithTenant = useCallback(
    (headers: HeadersInit = {}) => {
      const merged = new Headers(headers);
      if (tenantId) {
        merged.set("X-Tenant-Id", tenantId);
      }
      merged.set("X-Requested-With", "XMLHttpRequest");
      return merged;
    },
    [tenantId]
  );

  const withTenant = useCallback(
    (path: string) =>
      tenantId ? `${path}${path.includes("?") ? "&" : "?"}tenantId=${encodeURIComponent(tenantId)}` : path,
    [tenantId]
  );

  const addToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const loadUsers = useCallback(async () => {
    if (!tenantId) return;
    setLoadingUsers(true);
    try {
      const response = await fetch(withTenant("/api/users"), {
        headers: headersWithTenant()
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to load users");
      }
      const json = (await response.json()) as { users: TaskOwner[] };
      setUsers(json.users);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingUsers(false);
    }
  }, [headersWithTenant, tenantId, withTenant]);

  const loadProjects = useCallback(async () => {
    if (!tenantId) return;
    setLoadingProjects(true);
    try {
      const response = await fetch(withTenant("/api/projects"), {
        headers: headersWithTenant()
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to load projects");
      }
      const json = (await response.json()) as { projects: ApiProject[] };
      setProjects(json.projects);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingProjects(false);
    }
  }, [headersWithTenant, tenantId, withTenant]);

  const loadPolicies = useCallback(async () => {
    if (!tenantId) {
      if (!tenantLoading) {
        setError("Tenant context missing. Launch Tasks from a tenant in the portal.");
      }
      return;
    }
    setLoadingPolicies(true);
    setError(null);
    try {
      const response = await fetch(withTenant("/api/settings/permissions"), {
        headers: headersWithTenant()
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to load permission policies");
      }
      const json = (await response.json()) as { policies: ApiPolicy[] };
      setPolicies(json.policies);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingPolicies(false);
    }
  }, [headersWithTenant, tenantId, tenantLoading, withTenant]);

  useEffect(() => {
    if (!tenantId) return;
    void loadUsers();
  }, [loadUsers, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    void loadProjects();
  }, [loadProjects, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    void loadPolicies();
  }, [loadPolicies, tenantId]);

  useEffect(() => {
    if (users.length === 0) {
      setPolicyDrafts({});
      setProjectFormState((prev) => ({ ...prev, userId: "" }));
      return;
    }

    const globalPolicies = new Map(
      policies
        .filter((policy) => policy.projectId === null)
        .map((policy) => [policy.userId, policy])
    );

    setPolicyDrafts(() => {
      const next: Record<string, PolicyDraft> = {};
      for (const user of users) {
        const policy = globalPolicies.get(user.id);
        next[user.id] = policy
          ? {
              userId: user.id,
              policyId: policy.id,
              canManage: policy.canManage,
              canEdit: policy.canEdit,
              canComment: policy.canComment,
              canAssign: policy.canAssign,
              dirty: false
            }
          : makeDefaultDraft(user.id);
      }
      return next;
    });

    setProjectFormState((prev) => {
      if (prev.userId && users.some((user) => user.id === prev.userId)) {
        return prev;
      }
      return { ...prev, userId: users[0]!.id };
    });
  }, [policies, users]);

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt),
    [projects]
  );

  useEffect(() => {
    if (activeProjects.length === 0) {
      setProjectFormState((prev) => ({ ...prev, projectId: null }));
      return;
    }
    setProjectFormState((prev) => {
      if (prev.projectId && activeProjects.some((project) => project.id === prev.projectId)) {
        return prev;
      }
      return { ...prev, projectId: activeProjects[0]!.id };
    });
  }, [activeProjects]);

  const userLookup = useMemo(() => {
    const map = new Map<string, TaskOwner>();
    for (const user of users) {
      map.set(user.id, user);
    }
    return map;
  }, [users]);

  const projectPolicies = useMemo(
    () => policies.filter((policy) => policy.projectId !== null),
    [policies]
  );

  const handleDraftToggle = useCallback(
    (userId: string, key: DraftKey, value: boolean) => {
      setPolicyDrafts((prev) => {
        const draft = prev[userId];
        if (!draft) {
          return prev;
        }
        return {
          ...prev,
          [userId]: {
            ...draft,
            [key]: value,
            dirty: true
          }
        };
      });
    },
    []
  );

  const handleSaveDraft = useCallback(
    async (userId: string) => {
      const draft = policyDrafts[userId];
      if (!draft) return;
      if (!tenantId) return;

      setSavingUsers((prev) => ({ ...prev, [userId]: true }));
      try {
        const response = await fetch(withTenant("/api/settings/permissions"), {
          method: "POST",
          headers: headersWithTenant({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            userId: draft.userId,
            projectId: null,
            canManage: draft.canManage,
            canEdit: draft.canEdit,
            canComment: draft.canComment,
            canAssign: draft.canAssign
          })
        });

        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to save permission override");
        }

        const json = (await response.json()) as { policy: ApiPolicy };
        setPolicies((prev) => {
          const others = prev.filter(
            (policy) => !(policy.projectId === null && policy.userId === userId)
          );
          return [...others, json.policy];
        });
        setPolicyDrafts((prev) => ({
          ...prev,
          [userId]: {
            userId,
            policyId: json.policy.id,
            canManage: json.policy.canManage,
            canEdit: json.policy.canEdit,
            canComment: json.policy.canComment,
            canAssign: json.policy.canAssign,
            dirty: false
          }
        }));
        addToast(`Permissions updated for ${formatUserName(userLookup.get(userId), userId)}`);
      } catch (err) {
        addToast((err as Error).message, "error");
      } finally {
        setSavingUsers((prev) => ({ ...prev, [userId]: false }));
      }
    },
    [addToast, headersWithTenant, policyDrafts, tenantId, userLookup, withTenant]
  );

  const handleResetDraft = useCallback(
    async (userId: string) => {
      const draft = policyDrafts[userId];
      if (!draft) return;
      if (!tenantId) return;

      if (!draft.policyId) {
        setPolicyDrafts((prev) => ({
          ...prev,
          [userId]: makeDefaultDraft(userId)
        }));
        return;
      }

      setSavingUsers((prev) => ({ ...prev, [userId]: true }));
      try {
        const response = await fetch(withTenant(`/api/settings/permissions/${draft.policyId}`), {
          method: "DELETE",
          headers: headersWithTenant()
        });

        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to remove permission override");
        }

        setPolicies((prev) => prev.filter((policy) => policy.id !== draft.policyId));
        setPolicyDrafts((prev) => ({
          ...prev,
          [userId]: makeDefaultDraft(userId)
        }));
        addToast(`Permissions reset for ${formatUserName(userLookup.get(userId), userId)}`);
      } catch (err) {
        addToast((err as Error).message, "error");
      } finally {
        setSavingUsers((prev) => ({ ...prev, [userId]: false }));
      }
    },
    [addToast, headersWithTenant, policyDrafts, tenantId, userLookup, withTenant]
  );

  const handleProjectFormChange = useCallback(
    <K extends keyof PolicyFormState>(key: K, value: PolicyFormState[K]) => {
      setProjectFormState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleCreatePolicy = useCallback(async () => {
    if (!tenantId) return;
    if (!projectFormState.userId) {
      setProjectFormError("Select a user to override.");
      return;
    }
    if (!projectFormState.projectId) {
      setProjectFormError("Select a project to override.");
      return;
    }

    setProjectFormError(null);
    setCreatingOverride(true);
    try {
      const response = await fetch(withTenant("/api/settings/permissions"), {
        method: "POST",
        headers: headersWithTenant({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          userId: projectFormState.userId,
          projectId: projectFormState.projectId,
          canManage: projectFormState.canManage,
          canEdit: projectFormState.canEdit,
          canComment: projectFormState.canComment,
          canAssign: projectFormState.canAssign
        })
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to create project override");
      }

      const json = (await response.json()) as { policy: ApiPolicy };
      setPolicies((prev) => [...prev, json.policy]);
      setProjectFormState((prev) => ({
        ...prev,
        canManage: false,
        canEdit: false,
        canComment: false,
        canAssign: false
      }));
      addToast("Project override saved");
    } catch (err) {
      setProjectFormError((err as Error).message);
    } finally {
      setCreatingOverride(false);
    }
  }, [addToast, headersWithTenant, projectFormState, tenantId, withTenant]);

  const handleDeletePolicy = useCallback(
    async (policy: ApiPolicy) => {
      if (!tenantId) return;
      setDeletingPolicies((prev) => ({ ...prev, [policy.id]: true }));
      try {
        const response = await fetch(withTenant(`/api/settings/permissions/${policy.id}`), {
          method: "DELETE",
          headers: headersWithTenant()
        });

        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to remove override");
        }

        setPolicies((prev) => prev.filter((item) => item.id !== policy.id));
        if (policy.projectId === null) {
          setPolicyDrafts((prev) => ({
            ...prev,
            [policy.userId]: makeDefaultDraft(policy.userId)
          }));
        }
        addToast("Permission override removed");
      } catch (err) {
        addToast((err as Error).message, "error");
      } finally {
        setDeletingPolicies((prev) => ({ ...prev, [policy.id]: false }));
      }
    },
    [addToast, headersWithTenant, tenantId, withTenant]
  );

  if (!tenantLoading && !tenantId) {
    return (
      <div className="space-y-8">
        {toasts.length > 0 && (
          <div className="fixed right-4 top-4 z-50 space-y-2">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`rounded-md border px-3 py-2 text-sm shadow-lg ${
                  toast.variant === "error"
                    ? "border-red-500 bg-red-900/40 text-red-100"
                    : "border-fuchsia-500 bg-slate-900/90 text-fuchsia-100"
                }`}
              >
                {toast.message}
              </div>
            ))}
          </div>
        )}
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Permissions</h1>
          <p className="text-sm text-slate-400">
            Review Tasks permissions by member. Launch the app from the portal to choose a tenant.
          </p>
        </header>
        <div className="rounded-xl border border-red-600 bg-red-900/30 p-6 text-sm text-red-200">
          Tenant context missing. Launch Tasks from a tenant in the portal.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-md border px-3 py-2 text-sm shadow-lg ${
                toast.variant === "error"
                  ? "border-red-500 bg-red-900/40 text-red-100"
                  : "border-fuchsia-500 bg-slate-900/90 text-fuchsia-100"
              }`}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Permissions</h1>
        <p className="text-sm text-slate-400">
          Grant additional capabilities to Tasks members beyond their base identity roles, or scope
          overrides to individual projects.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">App-level permissions</h2>
          <p className="text-sm text-slate-400">
            Use overrides to grant additional manage, edit, comment, or assign rights across every
            project in the Tasks app. Members without an override inherit access from their identity
            role.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/40 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Member
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Manage
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Edit
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Comment
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Assign
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loadingUsers || loadingPolicies ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Loading members…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No members have access to Tasks yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const draft = policyDrafts[user.id] ?? makeDefaultDraft(user.id);
                  const saving = Boolean(savingUsers[user.id]);

                  return (
                    <tr key={user.id} className="bg-slate-950/40">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-white">
                          {user.fullName ?? user.email ?? user.id}
                        </div>
                        <div className="text-xs text-slate-500">{user.email ?? user.id}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {draft.policyId ? "Override active" : "Inherited from identity"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                          checked={draft.canManage}
                          onChange={(event) =>
                            handleDraftToggle(user.id, "canManage", event.target.checked)
                          }
                          disabled={saving}
                          aria-label={`Manage override for ${formatUserName(user, user.id)}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                          checked={draft.canEdit}
                          onChange={(event) =>
                            handleDraftToggle(user.id, "canEdit", event.target.checked)
                          }
                          disabled={saving}
                          aria-label={`Edit override for ${formatUserName(user, user.id)}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                          checked={draft.canComment}
                          onChange={(event) =>
                            handleDraftToggle(user.id, "canComment", event.target.checked)
                          }
                          disabled={saving}
                          aria-label={`Comment override for ${formatUserName(user, user.id)}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                          checked={draft.canAssign}
                          onChange={(event) =>
                            handleDraftToggle(user.id, "canAssign", event.target.checked)
                          }
                          disabled={saving}
                          aria-label={`Assign override for ${formatUserName(user, user.id)}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-200 disabled:opacity-50"
                            onClick={() => void handleResetDraft(user.id)}
                            disabled={saving || (!draft.dirty && draft.policyId === null)}
                          >
                            {saving && draft.policyId === null ? "Resetting…" : "Reset"}
                          </button>
                          <button
                            type="button"
                            className="rounded-md bg-fuchsia-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
                            onClick={() => void handleSaveDraft(user.id)}
                            disabled={saving || !draft.dirty}
                          >
                            {saving ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Project overrides</h2>
          <p className="text-sm text-slate-400">
            Apply more granular overrides for a single project. These stack on top of the app-level
            permissions shown above.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="override-user">
                Member
              </label>
              <select
                id="override-user"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                value={projectFormState.userId}
                onChange={(event) => handleProjectFormChange("userId", event.target.value)}
                disabled={users.length === 0}
              >
                {users.length === 0 ? (
                  <option value="">No members available</option>
                ) : (
                  users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {formatUserName(user, user.id)}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="override-project">
                Project
              </label>
              <select
                id="override-project"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                value={projectFormState.projectId ?? ""}
                onChange={(event) =>
                  handleProjectFormChange("projectId", event.target.value || null)
                }
                disabled={activeProjects.length === 0}
              >
                {activeProjects.length === 0 ? (
                  <option value="">No active projects</option>
                ) : (
                  activeProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-1">
              <span className="text-xs uppercase tracking-wide text-slate-500">Permissions</span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                    checked={projectFormState.canManage}
                    onChange={(event) => handleProjectFormChange("canManage", event.target.checked)}
                  />
                  Manage
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                    checked={projectFormState.canEdit}
                    onChange={(event) => handleProjectFormChange("canEdit", event.target.checked)}
                  />
                  Edit
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                    checked={projectFormState.canComment}
                    onChange={(event) => handleProjectFormChange("canComment", event.target.checked)}
                  />
                  Comment
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                    checked={projectFormState.canAssign}
                    onChange={(event) => handleProjectFormChange("canAssign", event.target.checked)}
                  />
                  Assign
                </label>
              </div>
            </div>
          </div>

          {projectFormError && (
            <div className="rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-sm text-red-200">
              {projectFormError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
              onClick={() => void handleCreatePolicy()}
              disabled={
                creatingOverride ||
                !projectFormState.userId ||
                !projectFormState.projectId ||
                users.length === 0 ||
                activeProjects.length === 0
              }
            >
              {creatingOverride ? "Saving…" : "Add Override"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/40 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Member
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Project
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Manage
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Edit
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Comment
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Assign
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Updated
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loadingPolicies || loadingProjects ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    Loading overrides…
                  </td>
                </tr>
              ) : projectPolicies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    No project-specific overrides.
                  </td>
                </tr>
              ) : (
                projectPolicies.map((policy) => {
                  const user = userLookup.get(policy.userId);
                  const deleting = Boolean(deletingPolicies[policy.id]);
                  return (
                    <tr key={policy.id} className="bg-slate-950/40">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-white">
                          {formatUserName(user, policy.userId)}
                        </div>
                        <div className="text-xs text-slate-500">{user?.email ?? policy.userId}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-200">
                        {resolveProjectName(policy.projectId, projects)}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-200">
                        {policy.canManage ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-200">
                        {policy.canEdit ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-200">
                        {policy.canComment ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-200">
                        {policy.canAssign ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 align-top text-slate-200">{formatDate(policy.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="rounded-md border border-red-600 px-3 py-1 text-xs text-red-300 transition hover:bg-red-600/10 disabled:opacity-50"
                          onClick={() => void handleDeletePolicy(policy)}
                          disabled={deleting}
                        >
                          {deleting ? "Removing…" : "Remove"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
