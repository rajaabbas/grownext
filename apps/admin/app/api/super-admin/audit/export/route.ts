import { NextResponse } from "next/server";

import { SuperAdminAuditLogQuerySchema, SuperAdminAuditExportResponseSchema } from "@ma/contracts";

import { createAuditExport } from "@/lib/identity";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = ["super-admin", "auditor"] as const;

export async function POST(request: Request) {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const roles = extractAdminRoles(session);
  if (!hasRequiredAdminRole(roles, ALLOWED_ROLES)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = SuperAdminAuditLogQuerySchema.partial().safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const exportResult = await createAuditExport(session.access_token, parsedBody.data);
    return NextResponse.json(SuperAdminAuditExportResponseSchema.parse(exportResult), { status: 200 });
  } catch (error) {
    console.error("Failed to create audit export", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
