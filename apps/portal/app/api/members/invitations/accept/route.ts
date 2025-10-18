import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptOrganizationInvitation } from "@/lib/identity";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { requireRequestedWithHeader } from "@/lib/security";

const requestSchema = z.object({
  token: z.string().min(1)
});

export async function POST(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  try {
    const result = await acceptOrganizationInvitation(session.access_token, parsed.data.token);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "invitation_expired") {
      return NextResponse.json({ error: "invitation_expired" }, { status: 410 });
    }
    if (message === "invitation_revoked") {
      return NextResponse.json({ error: "invitation_revoked" }, { status: 410 });
    }
    if (message === "invitation_already_accepted") {
      return NextResponse.json({ error: "invitation_already_accepted" }, { status: 409 });
    }
    if (message === "invitation_email_mismatch") {
      return NextResponse.json({ error: "invitation_email_mismatch" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "invitation_accept_failed", detail: message },
      { status: 400 }
    );
  }
}
