import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SuperAdminImpersonationRequestSchema,
  SuperAdminImpersonationResponseSchema
} from "@ma/contracts";

import { createImpersonationSession } from "@/lib/identity";
import { extractAdminRoles, hasRequiredAdminRole } from "@/lib/roles";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ userId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: { userId: string } }) {
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

  const body = await request.json().catch(() => ({}));
  const parsedBody = SuperAdminImpersonationRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await createImpersonationSession(
      session.access_token,
      parsedParams.data.userId,
      parsedBody.data
    );

    return NextResponse.json(SuperAdminImpersonationResponseSchema.parse(result), { status: 200 });
  } catch (error) {
    console.error("Failed to create impersonation session", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
