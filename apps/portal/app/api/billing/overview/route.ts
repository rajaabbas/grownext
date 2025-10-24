import { NextResponse } from "next/server";
import { fetchPortalBillingOverview } from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";
import { identityErrorResponse, isIdentityHttpError } from "@/lib/identity-error";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const overview = await fetchPortalBillingOverview(access.accessToken, {
      organizationId: access.launcher.user.organizationId
    });
    return NextResponse.json(overview);
  } catch (error) {
    if (isIdentityHttpError(error)) {
      return identityErrorResponse(error);
    }
    return NextResponse.json(
      { error: "failed_to_load_billing_overview", message: (error as Error).message },
      { status: 502 }
    );
  }
}
