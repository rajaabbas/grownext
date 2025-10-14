import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";
import { createTenant } from "@/lib/identity";

const requestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional()
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
    const result = await createTenant(session.access_token, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create tenant", message: (error as Error).message },
      { status: 502 }
    );
  }
}
