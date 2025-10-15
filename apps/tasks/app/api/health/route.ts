import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";

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
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }

    const tenantId = resolveTenantId(request);
    const context = await getTasksAuthContext(session, tenantId ?? undefined);
    return NextResponse.json({
      status: "ok",
      tenant: context.tenantId,
      roles: context.roles
    });
  } catch (error) {
    return NextResponse.json({ status: "unauthorized", message: (error as Error).message }, { status: 401 });
  }
}
