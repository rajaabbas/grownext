"use client";

import type { SuperAdminUsersResponse, SuperAdminUserStatus } from "@ma/contracts";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";

interface UsersTableProps {
  initialData: SuperAdminUsersResponse;
  initialQuery?: {
    search?: string;
    page?: number;
    status?: SuperAdminUserStatus;
  };
}

const STATUS_LABELS: Record<SuperAdminUserStatus, string> = {
  ACTIVE: "Active",
  INVITED: "Invited",
  SUSPENDED: "Suspended",
  DEACTIVATED: "Deactivated"
};

const STATUS_CLASSES: Record<SuperAdminUserStatus, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-100/80 text-emerald-800",
  INVITED: "border-amber-200 bg-amber-100/80 text-amber-800",
  SUSPENDED: "border-rose-200 bg-rose-100/80 text-rose-800",
  DEACTIVATED: "border-slate-300 bg-slate-200/70 text-slate-700"
};

const STATUS_FILTER_OPTIONS: { label: string; value: "" | SuperAdminUserStatus }[] = [
  { label: "All statuses", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Invited", value: "INVITED" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Deactivated", value: "DEACTIVATED" }
];

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

export const UsersTable = ({ initialData, initialQuery }: UsersTableProps) => {
  const [data, setData] = useState<SuperAdminUsersResponse>(initialData);
  const [search, setSearch] = useState(initialQuery?.search ?? "");
  const [statusFilter, setStatusFilter] = useState<SuperAdminUserStatus | "">(initialQuery?.status ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasNext = data.pagination.hasNextPage;
  const hasPrevious = data.pagination.hasPreviousPage;

  const fetchUsers = useCallback(
    (options: { search?: string; page?: number; status?: SuperAdminUserStatus | "" }) => {
      startTransition(async () => {
        try {
          const params = new URLSearchParams();
          if (options.search) {
            params.set("search", options.search);
          }
          if (options.status) {
            params.set("status", options.status);
          }
          if (options.page && options.page > 1) {
            params.set("page", String(options.page));
          }

          const queryString = params.toString();
          const response = await fetch(
            queryString ? `/api/super-admin/users?${queryString}` : "/api/super-admin/users",
            {
              cache: "no-store"
            }
          );

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error ?? `Request failed (${response.status})`);
          }

          const payload = (await response.json()) as SuperAdminUsersResponse;
          setData(payload);
          setError(null);
        } catch (requestError) {
          setError((requestError as Error).message);
        }
      });
    },
    []
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      fetchUsers({ search: search.trim(), status: statusFilter || undefined, page: 1 });
    },
    [fetchUsers, search, statusFilter]
  );

  const handleReset = useCallback(() => {
    setSearch("");
    setStatusFilter("");
    fetchUsers({ page: 1 });
  }, [fetchUsers]);

  const goToNext = useCallback(() => {
    if (!hasNext || isPending) return;
    fetchUsers({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      page: data.pagination.page + 1
    });
  }, [data.pagination.page, fetchUsers, hasNext, isPending, search, statusFilter]);

  const goToPrevious = useCallback(() => {
    if (!hasPrevious || isPending) return;
    fetchUsers({
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      page: Math.max(1, data.pagination.page - 1)
    });
  }, [data.pagination.page, fetchUsers, hasPrevious, isPending, search, statusFilter]);

  const totalSummary = useMemo(() => {
    const total = data.pagination.total;
    const { pageSize, page: currentPage } = data.pagination;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(total, currentPage * pageSize);
    if (total === 0) {
      return "No results";
    }
    return `${start}-${end} of ${total}`;
  }, [data.pagination]);

  const handleStatusChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as SuperAdminUserStatus | "";
      setStatusFilter(value);
      fetchUsers({
        search: search.trim() || undefined,
        status: value || undefined,
        page: 1
      });
    },
    [fetchUsers, search]
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-end">
          <label className="block flex-1 text-sm font-medium text-foreground">
            Search users
            <input
              type="text"
              name="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by email or name"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </label>
          <label className="block text-sm font-medium text-foreground md:w-48">
            Status
            <select
              name="status"
              value={statusFilter}
              onChange={handleStatusChange}
              disabled={isPending}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Searching…" : "Search"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending && search.length === 0 && !statusFilter}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          >
            Reset
          </button>
        </div>
      </form>

      {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">User</th>
              <th scope="col" className="px-4 py-3 text-left">Organizations</th>
              <th scope="col" className="px-4 py-3 text-left">Products</th>
              <th scope="col" className="px-4 py-3 text-left">Status</th>
              <th scope="col" className="px-4 py-3 text-left">Last Activity</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {data.users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No users match the current filters. Adjust your search criteria and try again.
                </td>
              </tr>
            ) : (
              data.users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{user.fullName ?? "Name unavailable"}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {user.organizations.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No memberships</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {user.organizations.map((org) => (
                          <span key={org.id} className="rounded-full border border-border px-2 py-0.5">
                            {org.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.productCount === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {user.productSlugs.map((slug) => (
                          <span key={slug} className="rounded-full border border-border px-2 py-0.5 uppercase">
                            {slug}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[user.status]}`}
                    >
                      {STATUS_LABELS[user.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(user.lastActivityAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/users/${user.id}`}
                      className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      View details
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{totalSummary}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevious}
            disabled={!hasPrevious || isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={goToNext}
            disabled={!hasNext || isPending}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
