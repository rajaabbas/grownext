import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { addTenantMember } from "@/lib/identity";

const requestSchema = z.object({
  organizationMemberId: z.string().min(1, "organizationMemberId is required"),
  role: z.string().min(1, "role is required")
});

type RouteParams = {
  params: {
    tenantId: string;
  };
};

export async function POST(request: Request, { params }: RouteParams) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

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
    await addTenantMember(session.access_token, {
      tenantId: params.tenantId,
      organizationMemberId: parsed.data.organizationMemberId,
      role: parsed.data.role
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add tenant member", message: (error as Error).message },
      { status: 502 }
    );
  }
}
