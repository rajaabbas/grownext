import { randomUUID } from "node:crypto";
import type { ProductEntitlement, ProductRole } from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "./prisma";
import { Prisma } from "@prisma/client";
import { buildServiceRoleClaims } from "@ma/core";

interface GrantEntitlementInput {
  organizationId: string;
  tenantId: string;
  productId: string;
  userId: string;
  roles: ProductRole[];
  expiresAt?: Date | null;
}

export const grantEntitlement = async (
  claims: SupabaseJwtClaims | null,
  input: GrantEntitlementInput
): Promise<ProductEntitlement> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.productEntitlement.upsert({
      where: {
        userId_productId_tenantId: {
          userId: input.userId,
          productId: input.productId,
          tenantId: input.tenantId
        }
      },
      update: {
        roles: input.roles,
        expiresAt: input.expiresAt ?? null
      },
      create: {
        id: randomUUID(),
        organizationId: input.organizationId,
        tenantId: input.tenantId,
        productId: input.productId,
        userId: input.userId,
        roles: input.roles,
        expiresAt: input.expiresAt ?? null
      }
    })
  );
};

export const revokeEntitlement = async (
  claims: SupabaseJwtClaims | null,
  params: { organizationId: string; userId: string; productId: string; tenantId: string }
): Promise<void> => {
  try {
    await withAuthorizationTransaction(claims ?? buildServiceRoleClaims(params.organizationId), (tx) =>
      tx.productEntitlement.delete({
        where: {
          userId_productId_tenantId: {
            userId: params.userId,
            productId: params.productId,
            tenantId: params.tenantId
          }
        }
      })
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return;
    }
    throw error;
  }
};

export const listEntitlementsForUser = async (
  claims: SupabaseJwtClaims | null,
  userId: string
): Promise<
  Array<
    ProductEntitlement & {
      product: {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        iconUrl: string | null;
        launcherUrl: string | null;
        redirectUris: string[];
        postLogoutRedirectUris: string[];
      };
    }
  >
> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.productEntitlement.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            iconUrl: true,
            launcherUrl: true,
            redirectUris: true,
            postLogoutRedirectUris: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    })
  );
};

export const listEntitlementsForTenant = async (
  claims: SupabaseJwtClaims | null,
  tenantId: string
): Promise<ProductEntitlement[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.productEntitlement.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" }
    })
  );
};

export const getEntitlementById = async (
  claims: SupabaseJwtClaims | null,
  entitlementId: string
): Promise<ProductEntitlement | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.productEntitlement.findUnique({
      where: { id: entitlementId }
    })
  );
};

export const listEntitlementsForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<ProductEntitlement[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.productEntitlement.findMany({
      where: { organizationId },
      orderBy: [{ tenantId: "asc" }, { productId: "asc" }, { createdAt: "asc" }]
    })
  );
};
