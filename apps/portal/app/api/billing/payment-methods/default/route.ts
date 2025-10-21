import { NextResponse } from "next/server";
import { PortalBillingSetDefaultPaymentMethodRequestSchema } from "@ma/contracts";
import { setPortalDefaultBillingPaymentMethod } from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";
import { requireRequestedWithHeader } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = PortalBillingSetDefaultPaymentMethodRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const response = await setPortalDefaultBillingPaymentMethod(access.accessToken, parsed.data);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: "failed_to_set_default_payment_method", message: (error as Error).message },
      { status: 502 }
    );
  }
}
