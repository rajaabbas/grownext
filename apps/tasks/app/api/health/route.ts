import { NextResponse } from "next/server";
import { validateIdentity } from "@/lib/identity";

export async function GET(request: Request) {
  try {
    const verification = await validateIdentity(request.headers as Headers);
    return NextResponse.json({
      status: "ok",
      tenant: verification.payload.tenant_id,
      roles: verification.entitlements[0]?.roles ?? []
    });
  } catch (error) {
    return NextResponse.json({ status: "unauthorized", message: (error as Error).message }, { status: 401 });
  }
}
