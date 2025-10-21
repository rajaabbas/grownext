import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchPortalLauncher, updateOrganization, deleteOrganization } from "@/lib/identity";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { requireRequestedWithHeader } from "@/lib/security";

const updateSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(2)
});

export async function GET() {
  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const launcher = await fetchPortalLauncher(session.access_token);
    return NextResponse.json({ organization: launcher.user.organizationId ?? null });
  } catch (error) {
    const message = (error as Error).message ?? "unknown";
    if (message.includes("404") || message.includes("400")) {
      return NextResponse.json({ error: "organization_not_found" }, { status: 404 });
    }
    if (message.includes("401")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to resolve organization", message },
      { status: 502 }
    );
  }
}

export async function PATCH(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

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

const deleteSchema = z.object({ organizationId: z.string().min(1) });

export async function DELETE(request: Request) {
  const csrfResponse = requireRequestedWithHeader(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

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
    await deleteOrganization(session.access_token, parsed.data.organizationId);
    await supabase.auth.signOut();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete organization", message: (error as Error).message },
      { status: 502 }
    );
  }
}
