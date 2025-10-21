import { Prisma, type BillingContact, type BillingContactRole, type BillingTaxId } from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { randomUUID } from "node:crypto";
import { withAuthorizationTransaction } from "../prisma";

export interface BillingContactInput {
  id?: string;
  name: string;
  email: string;
  role: BillingContactRole;
  phone?: string | null;
  metadata?: Prisma.JsonValue | null;
}

export const listBillingContacts = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<BillingContact[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingContact.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    })
  );
};

export const replaceBillingContacts = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  contacts: BillingContactInput[]
): Promise<BillingContact[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const normalized = contacts.map((contact) => ({
      ...contact,
      id: contact.id?.trim() || undefined
    }));

    const retainedIds = normalized
      .map((contact) => contact.id)
      .filter((id): id is string => typeof id === "string");

    if (normalized.length === 0) {
      await tx.billingContact.deleteMany({ where: { organizationId } });
      return [];
    }

    await tx.billingContact.deleteMany({
      where: {
        organizationId,
        id: { notIn: retainedIds }
      }
    });

    for (const contact of normalized) {
      if (contact.id) {
        await tx.billingContact.upsert({
          where: { id: contact.id },
          update: {
            name: contact.name,
            email: contact.email,
            role: contact.role,
            phone: contact.phone ?? null,
            metadata:
              contact.metadata !== undefined ? contact.metadata ?? Prisma.JsonNull : undefined
          },
          create: {
            id: contact.id,
            organizationId,
            name: contact.name,
            email: contact.email,
            role: contact.role,
            phone: contact.phone ?? null,
            metadata: contact.metadata ?? Prisma.JsonNull
          }
        });
      } else {
        await tx.billingContact.create({
          data: {
            id: randomUUID(),
            organizationId,
            name: contact.name,
            email: contact.email,
            role: contact.role,
            phone: contact.phone ?? null,
            metadata: contact.metadata ?? Prisma.JsonNull
          }
        });
      }
    }

    return tx.billingContact.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    });
  });
};

export interface BillingTaxIdInput {
  id?: string;
  type: string;
  value: string;
  country?: string | null;
  verified?: boolean;
  metadata?: Prisma.JsonValue | null;
}

export const listBillingTaxIds = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<BillingTaxId[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingTaxId.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    })
  );
};

export const replaceBillingTaxIds = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  taxIds: BillingTaxIdInput[]
): Promise<BillingTaxId[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const normalized = taxIds.map((entry) => ({
      ...entry,
      id: entry.id?.trim() || undefined
    }));

    const retainedIds = normalized
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === "string");

    if (normalized.length === 0) {
      await tx.billingTaxId.deleteMany({ where: { organizationId } });
      return [];
    }

    await tx.billingTaxId.deleteMany({
      where: {
        organizationId,
        id: { notIn: retainedIds }
      }
    });

    for (const entry of normalized) {
      if (entry.id) {
        await tx.billingTaxId.upsert({
          where: { id: entry.id },
          update: {
            type: entry.type,
            value: entry.value,
            country: entry.country ?? null,
            verified: entry.verified ?? false,
            metadata:
              entry.metadata !== undefined ? entry.metadata ?? Prisma.JsonNull : undefined
          },
          create: {
            id: entry.id,
            organizationId,
            type: entry.type,
            value: entry.value,
            country: entry.country ?? null,
            verified: entry.verified ?? false,
            metadata: entry.metadata ?? Prisma.JsonNull
          }
        });
      } else {
        await tx.billingTaxId.create({
          data: {
            id: randomUUID(),
            organizationId,
            type: entry.type,
            value: entry.value,
            country: entry.country ?? null,
            verified: entry.verified ?? false,
            metadata: entry.metadata ?? Prisma.JsonNull
          }
        });
      }
    }

    return tx.billingTaxId.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    });
  });
};
