import { Prisma, type AuditEvent, type AuditEventType } from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "./prisma";

interface RecordAuditEventInput {
  eventType: AuditEventType;
  actorUserId?: string | null;
  organizationId?: string | null;
  tenantId?: string | null;
  productId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const recordAuditEvent = async (
  claims: SupabaseJwtClaims | null,
  input: RecordAuditEventInput
): Promise<AuditEvent> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.auditEvent.create({
      data: {
        eventType: input.eventType,
        actorUserId: input.actorUserId ?? null,
        organizationId: input.organizationId ?? null,
        tenantId: input.tenantId ?? null,
        productId: input.productId ?? null,
        description: input.description ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue
      }
    })
  );
};

export interface AuditEventFilters {
  organizationId?: string;
  tenantId?: string;
  productId?: string;
  eventTypes?: AuditEventType[];
  limit?: number;
}

export const listAuditEvents = async (
  claims: SupabaseJwtClaims | null,
  filters: AuditEventFilters
): Promise<AuditEvent[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.auditEvent.findMany({
      where: {
        organizationId: filters.organizationId,
        tenantId: filters.tenantId,
        productId: filters.productId,
        eventType: filters.eventTypes ? { in: filters.eventTypes } : undefined
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 100
    })
  );
};
