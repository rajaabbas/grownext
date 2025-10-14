import { Prisma, PrismaClient } from "../generated/client";
import { env } from "@ma/core";
import type { SupabaseJwtClaims } from "@ma/core";

export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"]
});

export type PrismaTransaction = Prisma.TransactionClient;

const setRequestClaims = async (tx: PrismaTransaction, claims: SupabaseJwtClaims | null) => {
  const payload: SupabaseJwtClaims =
    claims != null
      ? {
          ...claims,
          role: claims.role ?? "authenticated",
          sub: claims.sub ?? "service-role"
        }
      : {
          role: "authenticated",
          sub: "service-role"
        };

  await tx.$executeRaw`select set_config('request.jwt.claims', ${JSON.stringify(payload)}, true)`;
};

export const withAuthorizationTransaction = async <T>(
  claims: SupabaseJwtClaims | null,
  callback: (tx: PrismaTransaction) => Promise<T>
): Promise<T> => {
  return prisma.$transaction(async (tx) => {
    await setRequestClaims(tx, claims);
    return callback(tx);
  });
};

export const disconnectPrisma = async () => {
  await prisma.$disconnect();
};

export const withTenantTransaction = withAuthorizationTransaction;

export { Prisma } from "../generated/client";
