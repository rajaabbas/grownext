import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { getTasksAuthContext } from "@/lib/identity-context";

export async function GET() {
  try {
    const supabase = getSupabaseRouteHandlerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
    }

    const context = await getTasksAuthContext(session);
    return NextResponse.json({
      status: "ok",
      tenant: context.tenantId,
      roles: context.roles
    });
  } catch (error) {
    return NextResponse.json({ status: "unauthorized", message: (error as Error).message }, { status: 401 });
  }
}
