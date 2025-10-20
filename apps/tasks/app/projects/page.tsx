"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from "react";
import { useTenantContext } from "@/components/tenant-context";

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

interface ApiProjectSummary {
  projectId: string | null;
  name: string;
  openCount: number;
  overdueCount: number;
  completedCount: number;
  scope: "all" | "project" | "unassigned";
}

interface ProjectFormState {
  name: string;
  description: string;
  color: string;
}

const DEFAULT_PROJECT_COLOR = "#6366F1";

const initialProjectFormState: ProjectFormState = {
  name: "",
  description: "",
  color: DEFAULT_PROJECT_COLOR
};

interface Toast {
  id: number;
  message: string;
  variant?: "success" | "error";
}

interface ApiPermissions {
  canView: boolean;
  canCreate: boolean;
  canManage: boolean;
}

export default function ProjectsPage() {
  const { activeTenantId: tenantId, loading: tenantLoading, refresh } = useTenantContext();

  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [summaries, setSummaries] = useState<ApiProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectFormState, setProjectFormState] = useState<ProjectFormState>(initialProjectFormState);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [permissions, setPermissions] = useState<ApiPermissions | null>(null);
  const [menuOpenProjectId, setMenuOpenProjectId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  const addToast = useCallback((message: string, variant: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

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
    (path: string) => (tenantId ? `${path}${path.includes("?") ? "&" : "?"}tenantId=${encodeURIComponent(tenantId)}` : path),
    [tenantId]
  );

  const loadProjects = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(withTenant("/api/projects"), {
        headers: headersWithTenant()
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to load projects");
      }

      const json = (await response.json()) as {
        projects?: ApiProject[];
        summaries?: ApiProjectSummary[];
        permissions?: ApiPermissions;
      };

      setProjects(Array.isArray(json.projects) ? json.projects : []);
      setSummaries(Array.isArray(json.summaries) ? json.summaries : []);
      setPermissions(json.permissions ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [headersWithTenant, tenantId, withTenant]);

  useEffect(() => {
    if (!tenantId) return;
    void loadProjects();
  }, [loadProjects, tenantId]);

  const summaryByProjectId = useMemo(() => {
    const map = new Map<string | null, ApiProjectSummary>();
    for (const summary of summaries) {
      map.set(summary.projectId, summary);
    }
    return map;
  }, [summaries]);

  const handleProjectFormChange = <K extends keyof ProjectFormState>(key: K, value: ProjectFormState[K]) => {
    setProjectFormState((prev) => ({ ...prev, [key]: value }));
  };

  const resetDialogState = useCallback(() => {
    setProjectFormState(initialProjectFormState);
    setProjectFormError(null);
  }, []);

  const openCreateDialog = useCallback(() => {
    setDialogMode("create");
    setEditingProjectId(null);
    resetDialogState();
    setDialogOpen(true);
  }, [resetDialogState]);

  const closeDialog = useCallback(() => {
    if (creating) return;
    setDialogOpen(false);
    setDialogMode("create");
    setEditingProjectId(null);
    resetDialogState();
  }, [creating, resetDialogState]);

  const handleDialogClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) {
        closeDialog();
      }
    },
    [closeDialog]
  );

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeDialog, dialogOpen]);

  const openEditDialog = useCallback(
    (project: ApiProject) => {
      setDialogMode("edit");
      setEditingProjectId(project.id);
      setProjectFormState({
        name: project.name,
        description: project.description ?? "",
        color: project.color ?? ""
      });
      setProjectFormError(null);
      setDialogOpen(true);
      setMenuOpenProjectId(null);
    },
    []
  );

  const handleSubmitProject = useCallback(async () => {
    if (!tenantId) {
      setProjectFormError("Tenant context missing. Launch Tasks from a tenant in the portal.");
      return;
    }

    const trimmedName = projectFormState.name.trim();
    if (!trimmedName) {
      setProjectFormError("Project name is required.");
      return;
    }

    const trimmedDescription = projectFormState.description.trim();
    const colorInput = projectFormState.color.trim();
    const normalizedColor =
      colorInput.length === 0 ? undefined : colorInput.startsWith("#") ? colorInput : `#${colorInput}`;

    setCreating(true);
    setProjectFormError(null);
    try {
      if (dialogMode === "create") {
        const response = await fetch(withTenant("/api/projects"), {
          method: "POST",
          headers: headersWithTenant({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            name: trimmedName,
            description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
            color: normalizedColor
          })
        });

        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to create project");
        }

        await loadProjects();
        await refresh();
        addToast("Project created");
        setDialogOpen(false);
        resetDialogState();
      } else if (dialogMode === "edit" && editingProjectId) {
        const response = await fetch(withTenant(`/api/projects/${editingProjectId}`), {
          method: "PATCH",
          headers: headersWithTenant({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            name: trimmedName,
            description: trimmedDescription,
            color: normalizedColor
          })
        });

        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to update project");
        }

        const json = (await response.json()) as {
          project?: ApiProject;
          summaries?: ApiProjectSummary[];
        };

        if (json.project) {
          setProjects((prev) => prev.map((item) => (item.id === json.project!.id ? json.project! : item)));
        }
        if (Array.isArray(json.summaries)) {
          setSummaries(json.summaries);
        }

        await refresh();

        addToast("Project updated");
        setDialogOpen(false);
        setDialogMode("create");
        setEditingProjectId(null);
        resetDialogState();
      } else {
        throw new Error("No project selected for editing.");
      }
    } catch (err) {
      const message = (err as Error).message;
      setProjectFormError(message);
      addToast(message, "error");
    } finally {
      setCreating(false);
    }
  }, [
    addToast,
    dialogMode,
    editingProjectId,
    headersWithTenant,
    loadProjects,
    projectFormState.color,
    projectFormState.description,
    projectFormState.name,
    refresh,
    resetDialogState,
    tenantId,
    withTenant
  ]);

  useEffect(() => {
    if (!menuOpenProjectId) {
      menuContainerRef.current = null;
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (menuContainerRef.current && menuContainerRef.current.contains(event.target as Node)) {
        return;
      }
      setMenuOpenProjectId(null);
    };

    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [menuOpenProjectId]);

  const handleDeleteProject = useCallback(
    async (project: ApiProject) => {
      if (permissions?.canManage === false) {
        addToast("You do not have permission to remove projects.", "error");
        setMenuOpenProjectId(null);
        return;
      }
      if (!tenantId) {
        addToast("Tenant context missing. Launch Tasks from a tenant in the portal.", "error");
        return;
      }

      setDeletingProjectId(project.id);

      try {
        const response = await fetch(withTenant(`/api/projects/${project.id}`), {
          method: "DELETE",
          headers: headersWithTenant()
        });

        if (!response.ok) {
          const json = await response.json().catch(() => null);
          throw new Error(json?.error ?? "Failed to delete project");
        }

        const json = (await response.json()) as {
          summaries?: ApiProjectSummary[];
        };

        setProjects((prev) => prev.filter((item) => item.id !== project.id));
        if (Array.isArray(json.summaries)) {
          setSummaries(json.summaries);
        }
        await refresh();
        addToast("Project deleted");
      } catch (err) {
        const message = (err as Error).message;
        addToast(message, "error");
      } finally {
        setDeletingProjectId(null);
        setMenuOpenProjectId(null);
      }
    },
    [addToast, headersWithTenant, permissions?.canManage, refresh, tenantId, withTenant]
  );

  const unassignedSummary = useMemo(
    () => summaries.find((summary) => summary.scope === "unassigned"),
    [summaries]
  );

  return (
    <section className="space-y-8">
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

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-white">Projects</h1>
          <p className="text-sm text-slate-400">
            Group tasks by initiative and keep teams aligned. Use the cards below to review status at a glance.
          </p>
        </div>
        <button
          className="self-start rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
          onClick={openCreateDialog}
          disabled={creating || tenantLoading || !tenantId || permissions?.canManage === false}
        >
          Add Project
        </button>
      </header>

      {!tenantLoading && !tenantId && (
        <div className="rounded-xl border border-red-600 bg-red-900/30 p-6 text-sm text-red-200">
          Tenant context missing. Launch Tasks from a tenant in the portal.
        </div>
      )}

      {tenantId && (
        <div className="space-y-6">
          {tenantLoading ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-300">Loading tenant context…</div>
          ) : loading ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-300">
              Loading projects…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-600 bg-red-900/30 p-6 text-sm text-red-200">{error}</div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-300">
              No projects yet. Create one to get started.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => {
                const summary = summaryByProjectId.get(project.id);
                const totalCount = (summary?.openCount ?? 0) + (summary?.completedCount ?? 0);
                const overdueCount = summary?.overdueCount ?? 0;
                const openCount = summary?.openCount ?? 0;
                const completedCount = summary?.completedCount ?? 0;
                const color = project.color?.startsWith("#") ? project.color : DEFAULT_PROJECT_COLOR;
                const menuOpen = menuOpenProjectId === project.id;
                const isDeleting = deletingProjectId === project.id;

                return (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg transition hover:border-fuchsia-500/40 hover:shadow-fuchsia-500/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="flex h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                          <h2 className="text-xl font-semibold text-white">{project.name}</h2>
                        </div>
                        {project.description && (
                          <p className="mt-2 text-sm text-slate-400 line-clamp-2">{project.description}</p>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        {project.archivedAt && (
                          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                            Archived
                          </span>
                        )}
                        {permissions?.canManage && (
                          <div
                            className="relative"
                            ref={menuOpen ? menuContainerRef : undefined}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setMenuOpenProjectId((prev) => (prev === project.id ? null : project.id))
                              }
                              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-fuchsia-100"
                              aria-haspopup="menu"
                              aria-expanded={menuOpen}
                              aria-label={`Project options for ${project.name}`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-5 w-5"
                              >
                                <path d="M10 4a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 4a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 4a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                              </svg>
                            </button>
                            {menuOpen && (
                              <div
                                role="menu"
                                className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-slate-800 bg-slate-900 p-1 text-sm shadow-xl"
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center rounded-md px-3 py-2 text-left text-slate-200 transition hover:bg-slate-800 hover:text-fuchsia-100"
                                  onClick={() => openEditDialog(project)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center rounded-md px-3 py-2 text-left text-red-300 transition hover:bg-red-600/20 disabled:opacity-60"
                                  onClick={() => void handleDeleteProject(project)}
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? "Deleting…" : "Delete"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <dl className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">Total</dt>
                        <dd className="text-lg font-semibold text-white">{totalCount}</dd>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">Open</dt>
                        <dd className="text-lg font-semibold text-white">{openCount}</dd>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                        <dt className="text-xs uppercase tracking-wide text-slate-500">Completed</dt>
                        <dd className="text-lg font-semibold text-white">{completedCount}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 text-xs text-slate-400">Overdue tasks: {overdueCount}</div>
                  </div>
                );
              })}

              {unassignedSummary && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
                  <h2 className="text-xl font-semibold text-white">Unassigned</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Tasks that haven&apos;t been linked to a project yet.
                  </p>
                  <dl className="mt-6 grid grid-cols-3 gap-3 text-center text-sm">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Total</dt>
                      <dd className="text-lg font-semibold text-white">
                        {unassignedSummary.openCount + unassignedSummary.completedCount}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Open</dt>
                      <dd className="text-lg font-semibold text-white">{unassignedSummary.openCount}</dd>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">Completed</dt>
                      <dd className="text-lg font-semibold text-white">{unassignedSummary.completedCount}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 text-xs text-slate-400">Overdue tasks: {unassignedSummary.overdueCount}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4" role="presentation">
          <div className="relative flex w-full max-w-lg justify-center">
            <button
              type="button"
              aria-label="Close project dialog"
              className="absolute inset-0 z-0"
              onClick={handleDialogClick}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-dialog-title"
              className="relative z-10 w-full rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl"
              tabIndex={-1}
            >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="project-dialog-title" className="text-lg font-semibold text-white">
                  {dialogMode === "create" ? "Add Project" : "Edit Project"}
                </h2>
                <p className="text-sm text-slate-400">
                  {dialogMode === "create"
                    ? "Define a new initiative to organize related tasks."
                    : "Update the project details to keep teams aligned."}
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-200 disabled:opacity-50"
                onClick={closeDialog}
                disabled={creating}
              >
                Close
              </button>
            </div>
            {projectFormError && (
              <div className="mt-4 rounded-md border border-red-600 bg-red-900/30 px-3 py-2 text-sm text-red-200">
                {projectFormError}
              </div>
            )}
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmitProject();
              }}
            >
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="project-name">
                  Name
                </label>
                <input
                  id="project-name"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                  placeholder="Marketing Launch"
                  value={projectFormState.name}
                  onChange={(event) => handleProjectFormChange("name", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="project-description">
                  Description
                </label>
                <textarea
                  id="project-description"
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                  rows={3}
                  placeholder="Optional context for the project"
                  value={projectFormState.description}
                  onChange={(event) => handleProjectFormChange("description", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="project-color">
                  Color
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="project-color"
                    type="color"
                    className="h-10 w-16 rounded border border-slate-700 bg-slate-900"
                    value={projectFormState.color || DEFAULT_PROJECT_COLOR}
                    onChange={(event) => handleProjectFormChange("color", event.target.value)}
                  />
                  <input
                    type="text"
                    className="w-32 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-fuchsia-500 focus:outline-none"
                    value={projectFormState.color}
                    onChange={(event) => handleProjectFormChange("color", event.target.value.toUpperCase())}
                    placeholder="#6366F1"
                    maxLength={9}
                  />
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-200"
                    onClick={() => handleProjectFormChange("color", "")}
                    disabled={creating}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-fuchsia-500 hover:text-fuchsia-200 disabled:opacity-50"
                  onClick={closeDialog}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
                  disabled={creating || !projectFormState.name.trim()}
                >
                  {dialogMode === "create"
                    ? creating
                      ? "Creating…"
                      : "Create Project"
                    : creating
                      ? "Saving…"
                      : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>
      )}
    </section>
  );
}
