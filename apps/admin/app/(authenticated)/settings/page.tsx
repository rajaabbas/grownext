import { redirect } from "next/navigation";

import { SettingsPanel } from "@/components/settings/settings-panel";
import { extractAdminRoles } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/signin");
  }

  const roles = extractAdminRoles(session);
  if (!roles.has("super-admin")) {
    redirect("/");
  }

  const initialFlags = {
    impersonationEnabled: process.env.NEXT_PUBLIC_SUPERADMIN_IMPERSONATION !== "false",
    auditExportsEnabled: process.env.NEXT_PUBLIC_SUPERADMIN_AUDIT_EXPORTS !== "false"
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure feature flags, operational guardrails, and observability endpoints for the Super Admin app.
        </p>
      </header>

      <SettingsPanel
        initialFlags={initialFlags}
        observabilityEndpoint={process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT}
      />
    </div>
  );
}
