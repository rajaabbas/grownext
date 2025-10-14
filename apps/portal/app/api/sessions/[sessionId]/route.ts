import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { revokeIdentitySession } from "@/lib/identity";

type RouteParams = {
  params: {
    sessionId: string;
  };
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await revokeIdentitySession(session.access_token, params.sessionId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to revoke session", message: (error as Error).message },
      { status: 502 }
    );
  }
}
