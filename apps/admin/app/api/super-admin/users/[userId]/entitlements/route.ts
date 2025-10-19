import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SuperAdminEntitlementGrantRequestSchema,
  SuperAdminEntitlementRevokeRequestSchema,
  SuperAdminUserDetailSchema
} from "@ma/contracts";
import {
  grantSuperAdminEntitlement,
  revokeSuperAdminEntitlement
} from "@ma/identity-client";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ userId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: { userId: string } }) {
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

  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = SuperAdminEntitlementGrantRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const detail = await grantSuperAdminEntitlement(
      session.access_token,
      parsedParams.data.userId,
      parsedBody.data
    );

    return NextResponse.json(SuperAdminUserDetailSchema.parse(detail), { status: 200 });
  } catch (error) {
    console.error("Failed to grant entitlement", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: { params: { userId: string } }) {
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

  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsedBody = SuperAdminEntitlementRevokeRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const detail = await revokeSuperAdminEntitlement(
      session.access_token,
      parsedParams.data.userId,
      parsedBody.data
    );

    return NextResponse.json(SuperAdminUserDetailSchema.parse(detail), { status: 200 });
  } catch (error) {
    console.error("Failed to revoke entitlement", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
