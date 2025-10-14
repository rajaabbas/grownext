import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { fetchPortalLauncher } from "@/lib/identity";

export async function GET() {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fetchPortalLauncher(session.access_token);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load portal data", message: (error as Error).message },
      { status: 502 }
    );
  }
}
