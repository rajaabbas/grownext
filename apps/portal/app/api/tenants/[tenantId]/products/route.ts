import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { grantTenantProduct } from "@/lib/identity";
import { requireRequestedWithHeader } from "@/lib/security";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  productId: z.string().min(1),
  userId: z.string().uuid().optional()
});

type RouteParams = {
  params: {
    tenantId: string;
  };
};

export async function POST(request: Request, { params }: RouteParams) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

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
    const result = await grantTenantProduct(session.access_token, {
      organizationId: parsed.data.organizationId,
      tenantId: params.tenantId,
      productId: parsed.data.productId,
      userId: parsed.data.userId ?? session.user.id
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to enable product", message: (error as Error).message },
      { status: 502 }
    );
  }
}
