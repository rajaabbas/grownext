import { NextResponse } from "next/server";
import { PortalBillingSubscriptionCancelRequestSchema } from "@ma/contracts";
import { cancelPortalBillingSubscription } from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";
import { requireRequestedWithHeader } from "@/lib/security";
import { identityErrorResponse, isIdentityHttpError } from "@/lib/identity-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = (await request.json().catch(() => ({}))) ?? {};
  const parsed = PortalBillingSubscriptionCancelRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const result = await cancelPortalBillingSubscription(access.accessToken, parsed.data, {
      organizationId: access.launcher.user.organizationId
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isIdentityHttpError(error)) {
      return identityErrorResponse(error);
    }
    return NextResponse.json(
      { error: "failed_to_cancel_subscription", message: (error as Error).message },
      { status: 502 }
    );
  }
}
