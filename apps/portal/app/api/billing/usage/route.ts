import { NextResponse } from "next/server";
import { BillingUsageQuerySchema } from "@ma/contracts";
import { fetchPortalBillingUsage } from "@/lib/identity";
import { requireBillingAccess } from "@/lib/billing/access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireBillingAccess();
  if (access.kind === "error") {
    return access.response;
  }

  const url = new URL(request.url);
  const queryObject: Record<string, string> = {};

  for (const key of ["featureKey", "from", "to", "resolution", "tenantId", "productId"]) {
    const value = url.searchParams.get(key);
    if (value) {
      queryObject[key] = value;
    }
  }

  const parsedQuery = BillingUsageQuerySchema.parse(queryObject);

  try {
    const usage = await fetchPortalBillingUsage(access.accessToken, parsedQuery);
    return NextResponse.json(usage);
  } catch (error) {
    return NextResponse.json(
      { error: "failed_to_load_usage", message: (error as Error).message },
      { status: 502 }
    );
  }
}
