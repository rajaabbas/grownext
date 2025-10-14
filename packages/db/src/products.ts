import { randomUUID } from "node:crypto";
import type { Product, TenantApplication, TenantApplicationEnvironment } from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { slugify } from "./utils/slugify";
import { withAuthorizationTransaction } from "./prisma";

interface RegisterProductInput {
  slug?: string | null;
  name: string;
  description?: string | null;
  clientId?: string;
  clientSecretHash: string;
  redirectUris?: string[];
  postLogoutRedirectUris?: string[];
  scopes?: string[];
  iconUrl?: string | null;
}

export const registerProduct = async (
  claims: SupabaseJwtClaims | null,
  input: RegisterProductInput
): Promise<Product> => {
  const slug = input.slug ?? slugify(input.name);
  const clientId = input.clientId ?? randomUUID();

  return withAuthorizationTransaction(claims, (tx) =>
    tx.product.create({
      data: {
        id: randomUUID(),
        slug,
        name: input.name,
        description: input.description ?? null,
        clientId,
        clientSecretHash: input.clientSecretHash,
        redirectUris: input.redirectUris ?? [],
        postLogoutRedirectUris: input.postLogoutRedirectUris ?? [],
        scopes: input.scopes ?? [],
        iconUrl: input.iconUrl ?? null
      }
    })
  );
};

export const listProducts = async (claims: SupabaseJwtClaims | null): Promise<Product[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.product.findMany({
      orderBy: { createdAt: "asc" }
    })
  );
};

export const linkProductToTenant = async (
  claims: SupabaseJwtClaims | null,
  params: {
    tenantId: string;
    productId: string;
    environment?: TenantApplicationEnvironment;
    consentRequired?: boolean;
  }
): Promise<TenantApplication> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.tenantApplication.upsert({
      where: {
        tenantId_productId_environment: {
          tenantId: params.tenantId,
          productId: params.productId,
          environment: params.environment ?? "PRODUCTION"
        }
      },
      update: {
        consentRequired: params.consentRequired ?? true
      },
      create: {
        id: randomUUID(),
        tenantId: params.tenantId,
        productId: params.productId,
        environment: params.environment ?? "PRODUCTION",
        consentRequired: params.consentRequired ?? true
      }
    })
  );
};

export const getProductByClientId = async (
  claims: SupabaseJwtClaims | null,
  clientId: string
): Promise<Product | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.product.findUnique({
      where: { clientId }
    })
  );
};
