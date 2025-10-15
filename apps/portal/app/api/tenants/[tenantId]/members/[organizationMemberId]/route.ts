import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { removeTenantMember, updateTenantMemberRole } from "@/lib/identity";

const updateSchema = z.object({
  role: z.string().min(1, "role is required")
});

type RouteParams = {
  params: {
    tenantId: string;
    organizationMemberId: string;
  };
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await updateTenantMemberRole(session.access_token, {
      tenantId: params.tenantId,
      organizationMemberId: params.organizationMemberId,
      role: parsed.data.role
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update tenant member", message: (error as Error).message },
      { status: 502 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await removeTenantMember(session.access_token, {
      tenantId: params.tenantId,
      organizationMemberId: params.organizationMemberId
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove tenant member", message: (error as Error).message },
      { status: 502 }
    );
  }
}
