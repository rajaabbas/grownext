import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import type { BoilerplateDatabase } from "@ma/contracts";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<BoilerplateDatabase, "public">({
    req,
    res
  });
  await supabase.auth.getSession();
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
