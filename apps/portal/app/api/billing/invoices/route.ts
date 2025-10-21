import { NextResponse } from "next/server";
import { fetchPortalBillingInvoices } from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  try {
    const invoices = await fetchPortalBillingInvoices(access.accessToken);
    return NextResponse.json(invoices);
  } catch (error) {
    return NextResponse.json(
      { error: "failed_to_load_invoices", message: (error as Error).message },
      { status: 502 }
    );
  }
}
