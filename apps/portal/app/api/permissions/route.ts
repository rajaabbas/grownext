import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { fetchPortalPermissions } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const permissions = await fetchPortalPermissions(session.access_token);
    return NextResponse.json(permissions);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load permissions", message: (error as Error).message },
      { status: 502 }
    );
  }
}
