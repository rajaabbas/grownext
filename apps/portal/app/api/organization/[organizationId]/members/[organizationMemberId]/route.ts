import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteOrganizationMember } from "@/lib/identity";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { requireRequestedWithHeader } from "@/lib/security";

const paramsSchema = z.object({
  organizationId: z.string().min(1),
  organizationMemberId: z.string().min(1)
});

export async function DELETE(request: Request, { params }: { params: { organizationId: string; organizationMemberId: string } }) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionOrgId =
    (session.user.app_metadata?.organization_id as string | undefined) ??
    (session.user.user_metadata?.organization_id as string | undefined);

  if (sessionOrgId && sessionOrgId !== parsed.data.organizationId) {
    return NextResponse.json({ error: "Organization mismatch" }, { status: 403 });
  }

  try {
    await deleteOrganizationMember(
      session.access_token,
      parsed.data.organizationId,
      parsed.data.organizationMemberId
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove member", message: (error as Error).message },
      { status: 502 }
    );
  }
}
