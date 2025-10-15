import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { deleteOrganizationInvitation } from "@/lib/identity";

const paramsSchema = z.object({
  invitationId: z.string().min(1)
});

const bodySchema = z.object({
  organizationId: z.string().min(1)
});

export async function DELETE(request: Request, { params }: { params: { invitationId: string } }) {
  const parseParams = paramsSchema.safeParse(params);
  if (!parseParams.success) {
    return NextResponse.json({ error: parseParams.error.message }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.message }, { status: 400 });
  }

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteOrganizationInvitation(
      session.access_token,
      parsedBody.data.organizationId,
      parseParams.data.invitationId
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete invitation", message: (error as Error).message },
      { status: 502 }
    );
  }
}
