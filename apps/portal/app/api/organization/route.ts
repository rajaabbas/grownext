import { NextResponse } from "next/server";
import { z } from "zod";
import { updateOrganization } from "@/lib/identity";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(2)
});

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
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
    const result = await updateOrganization(session.access_token, parsed.data.organizationId, {
      name: parsed.data.name
    });

    const metadata = {
      ...(session.user.user_metadata ?? {}),
      organization_name: parsed.data.name
    };

    await supabase.auth.updateUser({ data: metadata });

    return NextResponse.json({ organization: result.organization });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update organization", message: (error as Error).message },
      { status: 502 }
    );
  }
}
