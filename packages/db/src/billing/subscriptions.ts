import { Prisma } from "@prisma/client";
import type {
  BillingInterval,
  BillingSubscription,
  BillingSubscriptionSchedule,
  BillingSubscriptionScheduleStatus,
  BillingSubscriptionStatus
} from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { randomUUID } from "node:crypto";
import { withAuthorizationTransaction } from "../prisma";

export interface CreateBillingSubscriptionInput {
  organizationId: string;
  packageId: string;
  status?: BillingSubscriptionStatus;
  currency?: string;
  amountCents: number;
  billingInterval: BillingInterval;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  externalId?: string | null;
  metadata?: Prisma.JsonValue | null;
}

export interface UpdateBillingSubscriptionInput {
  status?: BillingSubscriptionStatus;
  packageId?: string;
  currency?: string;
  amountCents?: number;
  billingInterval?: BillingInterval;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  metadata?: Prisma.JsonValue | null;
  externalId?: string | null;
}

export interface ScheduleBillingChangeInput {
  subscriptionId: string;
  targetPackageId: string;
  effectiveAt: Date;
  status?: BillingSubscriptionScheduleStatus;
  metadata?: Prisma.JsonValue | null;
}

export const createBillingSubscription = async (
  claims: SupabaseJwtClaims | null,
  input: CreateBillingSubscriptionInput
): Promise<BillingSubscription> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingSubscription.create({
      data: {
        organizationId: input.organizationId,
        packageId: input.packageId,
        status: input.status ?? "ACTIVE",
        currency: input.currency ?? "usd",
        amountCents: input.amountCents,
        billingInterval: input.billingInterval,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        trialEndsAt: input.trialEndsAt ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        canceledAt: null,
        externalId: input.externalId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull
      }
    })
  );
};

export const updateBillingSubscription = async (
  claims: SupabaseJwtClaims | null,
  subscriptionId: string,
  input: UpdateBillingSubscriptionInput
): Promise<BillingSubscription> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingSubscription.update({
      where: { id: subscriptionId },
      data: {
        packageId: input.packageId ?? undefined,
        status: input.status ?? undefined,
        currency: input.currency ?? undefined,
        amountCents: input.amountCents ?? undefined,
        billingInterval: input.billingInterval ?? undefined,
        currentPeriodStart: input.currentPeriodStart ?? undefined,
        currentPeriodEnd: input.currentPeriodEnd ?? undefined,
        trialEndsAt: input.trialEndsAt ?? undefined,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? undefined,
        canceledAt: input.canceledAt ?? undefined,
        metadata:
          input.metadata !== undefined ? input.metadata ?? Prisma.JsonNull : undefined,
        externalId: input.externalId ?? undefined
      }
    })
  );
};

export const getBillingSubscriptionById = async (
  claims: SupabaseJwtClaims | null,
  subscriptionId: string
): Promise<BillingSubscription | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingSubscription.findUnique({
      where: { id: subscriptionId }
    })
  );
};

export const getActiveBillingSubscriptionForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<BillingSubscription | null> => {
  const activeStatuses: BillingSubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingSubscription.findFirst({
      where: {
        organizationId,
        status: { in: activeStatuses }
      },
      orderBy: { createdAt: "desc" }
    })
  );
};

export const listBillingSubscriptionsForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<BillingSubscription[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingSubscription.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    })
  );
};

export const listBillingSubscriptionSchedules = async (
  claims: SupabaseJwtClaims | null,
  subscriptionId: string
): Promise<BillingSubscriptionSchedule[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingSubscriptionSchedule.findMany({
      where: { subscriptionId },
      orderBy: { effectiveAt: "asc" }
    })
  );
};

export const scheduleBillingSubscriptionChange = async (
  claims: SupabaseJwtClaims | null,
  input: ScheduleBillingChangeInput
): Promise<BillingSubscriptionSchedule> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingSubscriptionSchedule.create({
      data: {
        id: randomUUID(),
        subscriptionId: input.subscriptionId,
        targetPackageId: input.targetPackageId,
        effectiveAt: input.effectiveAt,
        status: input.status ?? "PENDING",
        metadata: input.metadata ?? Prisma.JsonNull
      }
    })
  );
};

export const updateBillingSubscriptionScheduleStatus = async (
  claims: SupabaseJwtClaims | null,
  scheduleId: string,
  status: BillingSubscriptionScheduleStatus
): Promise<BillingSubscriptionSchedule> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingSubscriptionSchedule.update({
      where: { id: scheduleId },
      data: { status }
    })
  );
};

export const cancelBillingSubscription = async (
  claims: SupabaseJwtClaims | null,
  subscriptionId: string,
  options?: { invoiceThruPeriod?: boolean }
): Promise<BillingSubscription> => {
  const canceledAt = new Date();
  return withAuthorizationTransaction(claims, (tx) =>
    tx.billingSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: "CANCELED",
        canceledAt,
        cancelAtPeriodEnd: options?.invoiceThruPeriod ?? false
      }
    })
  );
};
