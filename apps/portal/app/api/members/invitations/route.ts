import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { createOrganizationInvitation } from "@/lib/identity";
import { requireRequestedWithHeader } from "@/lib/security";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  email: z.string().email(),
  role: z.string().default("MEMBER"),
  tenantId: z.string().optional(),
  tenantRole: z.string().optional(),
  expiresInHours: z.number().int().positive().max(720).optional()
});

export async function POST(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await createOrganizationInvitation(session.access_token, {
      organizationId: parsed.data.organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
      tenantId: parsed.data.tenantId,
      tenantRoles: parsed.data.tenantRole ? [parsed.data.tenantRole] : undefined,
      expiresInHours: parsed.data.expiresInHours
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "invitation_already_pending") {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Failed to create invitation", message },
      { status: 502 }
    );
  }
}
