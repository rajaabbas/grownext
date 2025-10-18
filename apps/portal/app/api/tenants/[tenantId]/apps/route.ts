import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { enableTenantApp } from "@/lib/identity";
import { requireRequestedWithHeader } from "@/lib/security";

type RouteParams = {
  params: {
    tenantId: string;
  };
};

const bodySchema = z.object({
  productId: z.string().min(1)
});

export async function POST(request: Request, { params }: RouteParams) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

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
    const result = await enableTenantApp(session.access_token, params.tenantId, parsed.data.productId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to enable app", message: (error as Error).message },
      { status: 502 }
    );
  }
}
