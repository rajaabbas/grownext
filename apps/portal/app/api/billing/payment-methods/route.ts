import { NextResponse } from "next/server";
import { PortalBillingPaymentMethodUpsertRequestSchema } from "@ma/contracts";
import {
  fetchPortalBillingPaymentMethods,
  upsertPortalBillingPaymentMethod
} from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";
import { requireRequestedWithHeader } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const methods = await fetchPortalBillingPaymentMethods(access.accessToken);
    return NextResponse.json(methods);
  } catch (error) {
    return NextResponse.json(
      { error: "failed_to_load_payment_methods", message: (error as Error).message },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = PortalBillingPaymentMethodUpsertRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const response = await upsertPortalBillingPaymentMethod(access.accessToken, parsed.data);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: "failed_to_save_payment_method", message: (error as Error).message },
      { status: 502 }
    );
  }
}
