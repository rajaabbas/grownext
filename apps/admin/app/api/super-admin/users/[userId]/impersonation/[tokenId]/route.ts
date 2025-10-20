import { NextResponse } from "next/server";
import { z } from "zod";

import { stopImpersonationSession } from "@/lib/identity";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  userId: z.string().min(1),
  tokenId: z.string().min(1)
});

export async function DELETE(_: Request, { params }: { params: { userId: string; tokenId: string } }) {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const roles = extractAdminRoles(session);
  if (!hasRequiredAdminRole(roles, ["super-admin"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  try {
    await stopImpersonationSession(
      session.access_token,
      parsedParams.data.userId,
      parsedParams.data.tokenId
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to stop impersonation session", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
