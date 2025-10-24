import { NextResponse } from "next/server";
import { z } from "zod";

import { SuperAdminUserStatusSchema } from "@ma/contracts";
import { getSuperAdminUsers } from "@/lib/identity";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { identityErrorResponse, isIdentityHttpError } from "@/lib/identity-error";

const querySchema = z.object({
  search: z.string().min(1).max(200).optional(),
  status: SuperAdminUserStatusSchema.optional(),
  page: z.coerce.number().int().min(1).optional()
});

export async function GET(request: Request) {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Failed to resolve session", error);
  }

  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const roles = extractAdminRoles(session);
  if (!hasRequiredAdminRole(roles, ["super-admin", "support"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status") ?? undefined;
  const status = rawStatus ? rawStatus.toUpperCase() : undefined;

  const query = querySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    status,
    page: searchParams.get("page") ?? undefined
  });

  if (!query.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  try {
    const data = await getSuperAdminUsers(session.access_token, {
      search: query.data.search,
      status: query.data.status,
      page: query.data.page
    });

    return NextResponse.json(data, { status: 200 });
  } catch (identityError) {
    console.error("Failed to fetch super admin users", identityError);
    if (isIdentityHttpError(identityError)) {
      return identityErrorResponse(identityError);
    }
    return NextResponse.json({ error: "upstream_failure" }, { status: 502 });
  }
}
