import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (payload) {
    console.info("[portal] LCP metric reported", payload);
  }

  return new NextResponse(null, { status: 204 });
}
