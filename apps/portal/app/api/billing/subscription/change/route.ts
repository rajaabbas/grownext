import { NextResponse } from "next/server";
import { PortalBillingSubscriptionChangeRequestSchema } from "@ma/contracts";
import { changePortalBillingSubscription } from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";
import { requireRequestedWithHeader } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = PortalBillingSubscriptionChangeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const result = await changePortalBillingSubscription(access.accessToken, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "failed_to_change_subscription", message: (error as Error).message },
      { status: 502 }
    );
  }
}
