import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { revokeTenantEntitlement } from "@/lib/identity";
import { requireRequestedWithHeader } from "@/lib/security";

type RouteParams = {
  params: {
    tenantId: string;
    entitlementId: string;
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
    await revokeTenantEntitlement(session.access_token, {
      tenantId: params.tenantId,
      entitlementId: params.entitlementId
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to revoke tenant entitlement", message: (error as Error).message },
      { status: 502 }
    );
  }
}
