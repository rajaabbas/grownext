import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { updateTenant, deleteTenant } from "@/lib/identity";

type RouteParams = {
  params: {
    tenantId: string;
  };
};

const updateSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable().optional()
});

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
    const result = await updateTenant(session.access_token, params.tenantId, {
      name: parsed.data.name,
      description: parsed.data.description ?? null
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update tenant", message: (error as Error).message },
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
    await deleteTenant(session.access_token, params.tenantId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete tenant", message: (error as Error).message },
      { status: 502 }
    );
  }
}
