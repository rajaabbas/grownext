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

export interface AuditEventSummary {
  id: string;
  eventType: AuditEventType;
  description: string | null;
  createdAt: string;
  actor: {
    id: string | null;
    email: string | null;
    fullName: string | null;
  } | null;
  tenant: {
    id: string | null;
    name: string | null;
  } | null;
  metadata: Record<string, unknown> | null;
}

const DEFAULT_ADMIN_EVENT_TYPES: AuditEventType[] = [
  "ADMIN_ACTION",
  "ENTITLEMENT_GRANTED",
  "ENTITLEMENT_REVOKED"
];

export const listRecentAdminActionsForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string,
  options?: { limit?: number; eventTypes?: AuditEventType[] }
): Promise<AuditEventSummary[]> => {
  return withAuthorizationTransaction(claims, async (tx) => {
    const events = await tx.auditEvent.findMany({
      where: {
        organizationId,
        eventType: {
          in: options?.eventTypes && options.eventTypes.length > 0
            ? options.eventTypes
            : DEFAULT_ADMIN_EVENT_TYPES
        }
      },
      include: {
        actor: {
          select: {
            userId: true,
            email: true,
            fullName: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 5
    });

    return events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      description: event.description ?? null,
      createdAt: event.createdAt.toISOString(),
      actor: event.actor
        ? {
            id: event.actor.userId,
            email: event.actor.email,
            fullName: event.actor.fullName
          }
        : null,
      tenant: event.tenant
        ? {
            id: event.tenant.id,
            name: event.tenant.name
          }
        : null,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null
    }));
  });
};
