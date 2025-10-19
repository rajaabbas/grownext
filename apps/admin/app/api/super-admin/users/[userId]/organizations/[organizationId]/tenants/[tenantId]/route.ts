import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SuperAdminTenantRoleUpdateRequestSchema,
  SuperAdminUserDetailSchema
} from "@ma/contracts";
import { updateSuperAdminTenantRole } from "@ma/identity-client";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string; organizationId: string; tenantId: string } }
) {
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

  const body = await request.json().catch(() => ({}));
  const parsedBody = SuperAdminTenantRoleUpdateRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsedParams = z
    .object({ userId: z.string().min(1), organizationId: z.string().min(1), tenantId: z.string().min(1) })
    .safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  try {
    const detail = await updateSuperAdminTenantRole(
      session.access_token,
      parsedParams.data.userId,
      parsedParams.data.organizationId,
      parsedParams.data.tenantId,
      parsedBody.data
    );

    return NextResponse.json(SuperAdminUserDetailSchema.parse(detail), { status: 200 });
  } catch (error) {
    console.error("Failed to update tenant role", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
