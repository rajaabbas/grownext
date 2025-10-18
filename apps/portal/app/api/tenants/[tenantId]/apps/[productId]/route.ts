import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { disableTenantApp } from "@/lib/identity";
import { requireRequestedWithHeader } from "@/lib/security";

type RouteParams = {
  params: {
    tenantId: string;
    productId: string;
  };
};

export async function DELETE(request: Request, { params }: RouteParams) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await disableTenantApp(session.access_token, params.tenantId, params.productId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to disable app", message: (error as Error).message },
      { status: 502 }
    );
  }
}
