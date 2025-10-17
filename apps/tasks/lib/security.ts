import { NextResponse } from "next/server";

const EXPECTED_REQUESTED_WITH = "XMLHttpRequest";

export const requireRequestedWithHeader = (request: Request): NextResponse | null => {
  const requestedWith = request.headers.get("x-requested-with");
  if (requestedWith !== EXPECTED_REQUESTED_WITH) {
    return NextResponse.json({ error: "invalid_csrf" }, { status: 400 });
  }
  return null;
};
