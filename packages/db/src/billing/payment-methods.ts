import { Prisma } from "@prisma/client";
import type {
  BillingPaymentMethod,
  BillingPaymentMethodStatus,
  BillingPaymentMethodType
} from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "../prisma";

export interface UpsertPaymentMethodInput {
  organizationId: string;
  providerId: string;
  type: BillingPaymentMethodType;
  status?: BillingPaymentMethodStatus;
  reference?: string | null;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  isDefault?: boolean;
  metadata?: Prisma.JsonValue | null;
}

export const upsertBillingPaymentMethod = async (
  claims: SupabaseJwtClaims | null,
  input: UpsertPaymentMethodInput
): Promise<BillingPaymentMethod> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    if (input.isDefault) {
      await tx.billingPaymentMethod.updateMany({
        where: {
          organizationId: input.organizationId,
          isDefault: true
        },
        data: { isDefault: false }
      });
    }

    return tx.billingPaymentMethod.upsert({
      where: {
        organizationId_providerId: {
          organizationId: input.organizationId,
          providerId: input.providerId
        }
      },
      update: {
        type: input.type,
        status: input.status ?? undefined,
        reference: input.reference ?? undefined,
        brand: input.brand ?? undefined,
        last4: input.last4 ?? undefined,
        expMonth: input.expMonth ?? undefined,
        expYear: input.expYear ?? undefined,
        isDefault: input.isDefault ?? undefined,
        metadata:
          input.metadata !== undefined ? input.metadata ?? Prisma.JsonNull : undefined
      },
      create: {
        organizationId: input.organizationId,
        providerId: input.providerId,
        type: input.type,
        status: input.status ?? "ACTIVE",
        reference: input.reference ?? null,
        brand: input.brand ?? null,
        last4: input.last4 ?? null,
        expMonth: input.expMonth ?? null,
        expYear: input.expYear ?? null,
        isDefault: input.isDefault ?? false,
        metadata: input.metadata ?? Prisma.JsonNull
      }
    });
  });
};

export const listBillingPaymentMethodsForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<BillingPaymentMethod[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingPaymentMethod.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    })
  );
};

export const setDefaultBillingPaymentMethod = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  paymentMethodId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, async (tx) => {
    await tx.billingPaymentMethod.updateMany({
      where: { organizationId },
      data: { isDefault: false }
    });

    await tx.billingPaymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true }
    });
  });
};

export const removeBillingPaymentMethod = async (
  claims: SupabaseJwtClaims | null,
  paymentMethodId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, (tx) =>
    tx.billingPaymentMethod.delete({
      where: { id: paymentMethodId }
    })
  );
};
