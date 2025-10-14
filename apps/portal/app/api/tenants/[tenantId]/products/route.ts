import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { grantTenantProduct } from "@/lib/identity";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  productId: z.string().min(1),
  roles: z.array(z.string().min(1)).default(["OWNER"])
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
    const result = await grantTenantProduct(session.access_token, {
      organizationId: parsed.data.organizationId,
      tenantId: params.tenantId,
      productId: parsed.data.productId,
      userId: session.user.id,
      roles: parsed.data.roles
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to enable product", message: (error as Error).message },
      { status: 502 }
    );
  }
}
