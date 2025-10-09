import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const accessToken = requestUrl.searchParams.get("access_token");
  const refreshToken = requestUrl.searchParams.get("refresh_token");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const supabase = createRouteHandlerClient<BoilerplateDatabase, "public">({
    cookies
  });

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
