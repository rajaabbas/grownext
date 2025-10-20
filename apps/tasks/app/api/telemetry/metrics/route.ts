import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (payload) {
    console.info("[tasks] telemetry metric", payload);
  }
  return NextResponse.json({ status: "recorded" }, { status: 202 });
}
