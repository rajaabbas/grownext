import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { updatePortalRolePermissions } from "@/lib/identity";
import { requireRequestedWithHeader } from "@/lib/security";
import { PortalPermissionsUpdateSchema } from "@ma/contracts";

type RouteParams = {
  params: {
    role: string;
  };
};

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const body = PortalPermissionsUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await updatePortalRolePermissions(
      session.access_token,
      params.role,
      body.data.permissions
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update permissions", message: (error as Error).message },
      { status: 502 }
    );
  }
}
