import { NextResponse } from "next/server";
import { mockLauncherData } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(mockLauncherData, { headers: { "Cache-Control": "no-store" } });
}
