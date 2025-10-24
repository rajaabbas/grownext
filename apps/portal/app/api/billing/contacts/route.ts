import { NextResponse } from "next/server";
import { PortalBillingContactsUpdateRequestSchema } from "@ma/contracts";
import { fetchPortalBillingContacts, updatePortalBillingContacts } from "@/lib/identity";
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
    const contacts = await fetchPortalBillingContacts(access.accessToken, {
      organizationId: access.launcher.user.organizationId
    });
    return NextResponse.json(contacts);
  } catch (error) {
    if (isIdentityHttpError(error)) {
      return identityErrorResponse(error);
    }
    return NextResponse.json(
      { error: "failed_to_load_billing_contacts", message: (error as Error).message },
      { status: 502 }
    );
  }
}

export async function PATCH(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = PortalBillingContactsUpdateRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const contacts = await updatePortalBillingContacts(access.accessToken, parsed.data, {
      organizationId: access.launcher.user.organizationId
    });
    return NextResponse.json(contacts);
  } catch (error) {
    if (isIdentityHttpError(error)) {
      return identityErrorResponse(error);
    }
    return NextResponse.json(
      { error: "failed_to_update_billing_contacts", message: (error as Error).message },
      { status: 502 }
    );
  }
}
