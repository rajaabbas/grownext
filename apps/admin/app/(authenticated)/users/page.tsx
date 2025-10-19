import Link from "next/link";
import { redirect } from "next/navigation";

import { UsersTable } from "@/components/users/users-table";
import { getSuperAdminUsers } from "@/lib/identity";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { SuperAdminUserStatusSchema } from "@ma/contracts";

interface UsersPageProps {
  searchParams?: {
    search?: string;
    page?: string;
    status?: string;
  };
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/signin");
  }

  const roles = extractAdminRoles(session);
  if (!hasRequiredAdminRole(roles, ["super-admin", "support"])) {
    redirect("/audit");
  }

  const canQueueBulkJobs = roles.has("super-admin");

  const search = typeof searchParams?.search === "string" && searchParams.search.trim().length > 0
    ? searchParams.search.trim()
    : undefined;
  const page = searchParams?.page ? Number.parseInt(searchParams.page, 10) || undefined : undefined;
  const statusParam = searchParams?.status;
  const parsedStatus = statusParam
    ? SuperAdminUserStatusSchema.safeParse(statusParam.toUpperCase())
    : null;
  const status = parsedStatus?.success ? parsedStatus.data : undefined;

  const users = await getSuperAdminUsers(session.access_token, {
    search,
    page,
    status
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Global user directory</h2>
        <p className="text-sm text-muted-foreground">
          Search, filter, and review user relationships across every GrowNext application. Use the detail view to inspect roles,
          entitlements, impersonation history, and audit trails.
        </p>
        {canQueueBulkJobs ? (
          <div>
            <Link
              href="/users/bulk"
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              → Launch bulk operations
            </Link>
          </div>
        ) : null}
      </header>
      <UsersTable
        initialData={users}
        initialQuery={{ search, page: users.pagination.page, status }}
      />
    </div>
  );
}
