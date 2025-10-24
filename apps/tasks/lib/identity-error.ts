import { NextResponse } from "next/server";
import { IdentityHttpError } from "@ma/identity-client";

interface IdentityErrorPayload {
  error: string;
  message: string;
}

const buildIdentityErrorPayload = (error: IdentityHttpError): IdentityErrorPayload => ({
  error: error.code ?? "identity_error",
  message: error.message
});

export const identityErrorResponse = (error: IdentityHttpError) => {
  const headers =
    typeof error.retryAfter === "number"
      ? {
          "retry-after": String(error.retryAfter)
        }
      : undefined;

  return NextResponse.json(buildIdentityErrorPayload(error), {
    status: error.status,
    headers
  });
};

export const isIdentityHttpError = (error: unknown): error is IdentityHttpError =>
  error instanceof IdentityHttpError;
