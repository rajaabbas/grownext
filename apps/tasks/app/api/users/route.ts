import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";
import { fetchTasksUsers } from "@ma/identity-client";
import { identityErrorResponse, isIdentityHttpError } from "@/lib/identity-error";
import { TASKS_PRODUCT_SLUG } from "../tasks/owners";

const querySchema = z.object({
  userId: z.union([z.string().min(1), z.array(z.string().min(1))]).optional()
});

const resolveTenantId = (request: Request): string | null => {
  const headerTenant = request.headers.get("x-tenant-id");
  if (headerTenant && headerTenant.trim().length > 0) {
    return headerTenant.trim();
  }

  try {
    const url = new URL(request.url);
    const queryTenant = url.searchParams.get("tenantId");
    return queryTenant && queryTenant.trim().length > 0 ? queryTenant.trim() : null;
  } catch {
    return null;
  }
};

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseRouteHandlerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = session.access_token;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = resolveTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: "tenant_required" }, { status: 400 });
    }

    const authContext = await getTasksAuthContext(session, tenantId);
    if (authContext.tenantId !== tenantId) {
      return NextResponse.json({ error: "tenant_mismatch" }, { status: 403 });
    }

    const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) {
      return NextResponse.json({ error: query.error.message }, { status: 400 });
    }

    const ids = query.data.userId;
    const userIds = Array.isArray(ids) ? ids : ids ? [ids] : undefined;

    const response = await fetchTasksUsers(accessToken, {
      ...(userIds ? { userIds } : {}),
      productSlug: TASKS_PRODUCT_SLUG,
      tenantId: authContext.tenantId
    });

    return NextResponse.json({ users: response.users });
  } catch (error) {
    if (isIdentityHttpError(error)) {
      return identityErrorResponse(error);
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
