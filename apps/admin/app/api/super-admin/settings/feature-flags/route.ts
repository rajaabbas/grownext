import { NextResponse } from "next/server";
import { z } from "zod";

import { recordEvent } from "@/lib/telemetry";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  impersonationEnabled: z.boolean(),
  auditExportsEnabled: z.boolean()
});

export async function POST(request: Request) {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const roles = extractAdminRoles(session);
  if (!hasRequiredAdminRole(roles, ["super-admin"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  recordEvent("feature_flags_updated", {
    userId: session.user.id,
    impersonationEnabled: parsed.data.impersonationEnabled,
    auditExportsEnabled: parsed.data.auditExportsEnabled
  });

  return NextResponse.json(parsed.data, { status: 200 });
}
