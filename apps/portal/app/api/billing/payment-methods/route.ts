import { NextResponse } from "next/server";
import { PortalBillingPaymentMethodUpsertRequestSchema } from "@ma/contracts";
import {
  fetchPortalBillingPaymentMethods,
  upsertPortalBillingPaymentMethod
} from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";
import { requireRequestedWithHeader } from "@/lib/security";
import { identityErrorResponse, isIdentityHttpError } from "@/lib/identity-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const methods = await fetchPortalBillingPaymentMethods(access.accessToken, {
      organizationId: access.launcher.user.organizationId
    });
    return NextResponse.json(methods);
  } catch (error) {
    if (isIdentityHttpError(error)) {
      return identityErrorResponse(error);
    }
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
    const response = await upsertPortalBillingPaymentMethod(access.accessToken, parsed.data, {
      organizationId: access.launcher.user.organizationId
    });
    return NextResponse.json(response);
  } catch (error) {
    if (isIdentityHttpError(error)) {
      return identityErrorResponse(error);
    }
    return NextResponse.json(
      { error: "failed_to_save_payment_method", message: (error as Error).message },
      { status: 502 }
    );
  }
}
