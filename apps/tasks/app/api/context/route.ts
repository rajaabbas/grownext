import { NextResponse } from "next/server";
import { fetchTasksContext } from "@ma/identity-client";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const TASKS_PRODUCT_SLUG = process.env.TASKS_PRODUCT_SLUG ?? "tasks";

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
    const context = await fetchTasksContext(accessToken, {
      productSlug: TASKS_PRODUCT_SLUG,
      tenantId: tenantId ?? undefined
    });

    return NextResponse.json({ context }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
