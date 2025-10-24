import { NextResponse } from "next/server";
import { fetchPortalBillingInvoices } from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";
import { identityErrorResponse, isIdentityHttpError } from "@/lib/identity-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const invoices = await fetchPortalBillingInvoices(access.accessToken, {
      organizationId: access.launcher.user.organizationId
    });
    return NextResponse.json(invoices);
  } catch (error) {
    if (isIdentityHttpError(error)) {
      return identityErrorResponse(error);
    }
    return NextResponse.json(
      { error: "failed_to_load_invoices", message: (error as Error).message },
      { status: 502 }
    );
  }
}
