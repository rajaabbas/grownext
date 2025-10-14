import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { createOrganization } from "@/lib/identity";

const requestSchema = z.object({
  name: z.string().min(2),
  defaultTenantName: z.string().min(2).optional()
});

export async function POST(request: Request) {
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
    const result = await createOrganization(session.access_token, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create organization", message: (error as Error).message },
      { status: 502 }
    );
  }
}
