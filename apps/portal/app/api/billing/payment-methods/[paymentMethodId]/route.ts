import { NextResponse } from "next/server";
import { deletePortalBillingPaymentMethod } from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";
import { requireRequestedWithHeader } from "@/lib/security";

export const dynamic = "force-dynamic";

interface RouteParams {
  paymentMethodId: string;
}

export async function DELETE(request: Request, { params }: { params: RouteParams }) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const paymentMethodId = params?.paymentMethodId;
  if (!paymentMethodId) {
    return NextResponse.json({ error: "paymentMethodId is required" }, { status: 400 });
  }

  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const response = await deletePortalBillingPaymentMethod(access.accessToken, paymentMethodId);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: "failed_to_remove_payment_method", message: (error as Error).message },
      { status: 502 }
    );
  }
}
