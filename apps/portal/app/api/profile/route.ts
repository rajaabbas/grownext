import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const updateProfileSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional()
  })
  .refine((data) => data.fullName || data.email, {
    message: "No changes provided"
  });

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);

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

  const metadata = {
    ...(session.user.user_metadata ?? {}),
    ...(parsed.data.fullName ? { full_name: parsed.data.fullName } : {})
  };

  const { data, error } = await supabase.auth.updateUser({
    email: parsed.data.email ?? undefined,
    data: metadata
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    user: {
      id: data.user?.id ?? session.user.id,
      email: data.user?.email ?? session.user.email,
      fullName: parsed.data.fullName ?? (session.user.user_metadata?.full_name as string | undefined) ?? null
    }
  });
}
