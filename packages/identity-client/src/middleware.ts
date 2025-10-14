import type { IdentityTokenValidator } from "./tokens";
import type { TokenValidationResult } from "./types";

export class IdentityMiddlewareError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

const extractBearer = (authorizationHeader?: string | null): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (!token || !/^Bearer$/i.test(scheme)) {
    return null;
  }
  return token;
};

export interface RequestContext {
  getHeader(name: string): string | null | undefined;
  setIdentity(identity: TokenValidationResult): void;
}

export const buildIdentityMiddleware =
  (validator: IdentityTokenValidator) =>
  async (context: RequestContext): Promise<void> => {
    const authHeader = context.getHeader("authorization");
    const token = extractBearer(authHeader ?? undefined);

    if (!token) {
      throw new IdentityMiddlewareError("Missing bearer token", 401);
    }

    try {
      const result = await validator.validateBearerToken(token);
      context.setIdentity(result);
    } catch (error) {
      throw new IdentityMiddlewareError((error as Error).message, 401);
    }
  };

export const verifyAuthorizationHeader = async (
  headers: Headers | { authorization?: string | string[] | undefined },
  validator: IdentityTokenValidator
): Promise<TokenValidationResult> => {
  const headerValue =
    headers instanceof Headers
      ? headers.get("authorization")
      : Array.isArray(headers.authorization)
        ? headers.authorization[0]
        : headers.authorization;

  const token = extractBearer(headerValue ?? undefined);

  if (!token) {
    throw new IdentityMiddlewareError("Missing bearer token", 401);
  }

  try {
    return await validator.validateBearerToken(token);
  } catch (error) {
    throw new IdentityMiddlewareError((error as Error).message, 401);
  }
};
