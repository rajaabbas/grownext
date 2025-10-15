import { NextResponse } from "next/server";
import { getSupabaseRouteHandlerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return errorResponse("Current password is required.", 400);
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return errorResponse("New password must be at least 8 characters long.", 400);
  }

  const supabase = getSupabaseRouteHandlerClient();
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return errorResponse("Unauthorized", 401);
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: session.user.email ?? "",
    password: currentPassword
  });

  if (reauthError) {
    return errorResponse("Current password is incorrect.", 400);
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

  if (updateError) {
    return errorResponse(updateError.message ?? "Failed to update password", 400);
  }

  return NextResponse.json({ success: true });
}
