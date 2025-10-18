import { NextResponse } from "next/server";

type ErrorCode =
  | "not_authenticated"
  | "task_not_found"
  | "project_not_found"
  | "permission_policy_not_found";

const STATUS_BY_ERROR: Record<ErrorCode, number> = {
  not_authenticated: 401,
  task_not_found: 404,
  project_not_found: 404,
  permission_policy_not_found: 404
};

const KNOWN_ERRORS = new Set<ErrorCode>(Object.keys(STATUS_BY_ERROR) as ErrorCode[]);

export const taskErrorToResponse = (error: unknown): NextResponse => {
  const message = error instanceof Error ? error.message : `${error}`;

  if (KNOWN_ERRORS.has(message as ErrorCode)) {
    const status = STATUS_BY_ERROR[message as ErrorCode] ?? 500;
    return NextResponse.json({ error: message }, { status });
  }

  console.error("Unhandled tasks API error", error);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
};
