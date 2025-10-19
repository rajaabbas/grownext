import { redirect } from "next/navigation";

import { BulkOperationsPanel } from "@/components/bulk/bulk-operations-panel";
import { listBulkJobs } from "@/lib/identity";
import { extractAdminRoles } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";

export default async function BulkOperationsPage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/signin");
  }

  const roles = extractAdminRoles(session);
  if (!roles.has("super-admin")) {
    redirect("/users");
  }

  let initialJobs: Awaited<ReturnType<typeof listBulkJobs>>["jobs"] = [];
  let initialError: string | null = null;

  try {
    const jobs = await listBulkJobs(session.access_token);
    initialJobs = jobs.jobs;
  } catch (error) {
    console.error("Unable to load bulk jobs", error);
    initialError = (error as Error).message ?? "Failed to load bulk jobs.";
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Bulk operations</h2>
        <p className="text-sm text-muted-foreground">
          Coordinate high-volume user changes behind feature flags and audit logging. Jobs run asynchronously and are safe to retry if they encounter failures.
        </p>
      </header>

      <BulkOperationsPanel initialJobs={initialJobs} initialError={initialError} />
    </div>
  );
}
