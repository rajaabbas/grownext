import { redirect } from "next/navigation";

import { AuditExplorer } from "@/components/audit/audit-explorer";
import { getAuditLogs } from "@/lib/identity";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import type { SuperAdminAuditLogResponse } from "@ma/contracts";

const ALLOWED_ROLES = ["super-admin", "auditor", "support"] as const;

export default async function AuditPage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/signin");
  }

  const roles = extractAdminRoles(session);
  if (!hasRequiredAdminRole(roles, ALLOWED_ROLES)) {
    redirect("/");
  }

  const fallbackLogs: SuperAdminAuditLogResponse = {
    events: [],
    pagination: {
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    }
  };

  let logs = fallbackLogs;
  let initialError: string | null = null;

  try {
    logs = await getAuditLogs(session.access_token, { page: 1 });
  } catch (error) {
    console.error("Unable to load audit logs", error);
    initialError = (error as Error).message ?? "Failed to load audit logs.";
  }
  const canExport = roles.has("super-admin") || roles.has("auditor");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Audit explorer</h2>
        <p className="text-sm text-muted-foreground">
          Inspect privileged actions, impersonation activity, and background jobs across every GrowNext surface.
        </p>
      </header>

      <AuditExplorer initialData={logs} canExport={canExport} initialError={initialError ?? undefined} />
    </div>
  );
}
