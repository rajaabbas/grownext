import { z } from "zod";
import {
  PortalLauncherResponseSchema,
  PortalPermissionsResponseSchema,
  PortalRolePermissionsSchema,
  SuperAdminUsersResponseSchema,
  SuperAdminUserDetailSchema,
  SuperAdminOrganizationRoleUpdateRequestSchema,
  SuperAdminTenantRoleUpdateRequestSchema,
  SuperAdminUserStatusUpdateRequestSchema,
  SuperAdminImpersonationRequestSchema,
  SuperAdminImpersonationResponseSchema,
  SuperAdminBulkJobCreateRequestSchema,
  SuperAdminBulkJobUpdateRequestSchema,
  SuperAdminBulkJobSchema,
  SuperAdminBulkJobsResponseSchema,
  SuperAdminAuditLogResponseSchema,
  SuperAdminAuditLogQuerySchema,
  SuperAdminAuditExportResponseSchema,
  SuperAdminImpersonationCleanupResponseSchema,
  TasksContextResponseSchema,
  TasksUsersResponseSchema,
  PortalBillingOverviewResponseSchema,
  PortalBillingUsageResponseSchema,
  BillingUsageQuerySchema,
  PortalBillingSubscriptionChangeRequestSchema,
  PortalBillingSubscriptionChangeResponseSchema,
  PortalBillingSubscriptionCancelRequestSchema,
  PortalBillingInvoiceListResponseSchema,
  PortalBillingContactsUpdateRequestSchema,
  PortalBillingContactsResponseSchema,
  PortalBillingPaymentMethodsResponseSchema,
  PortalBillingPaymentMethodUpsertRequestSchema,
  PortalBillingSetDefaultPaymentMethodRequestSchema,
  AdminBillingCatalogResponseSchema,
  AdminBillingPackageCreateRequestSchema,
  AdminBillingPackageUpdateRequestSchema,
  AdminBillingSubscriptionListResponseSchema,
  AdminBillingInvoiceListResponseSchema,
  AdminBillingUsageQuerySchema,
  AdminBillingUsageResponseSchema,
  AdminBillingInvoiceStatusUpdateRequestSchema,
  AdminBillingCreditIssueRequestSchema,
  AdminBillingCreditListResponseSchema,
  BillingPackageSchema,
  BillingInvoiceSchema,
  BillingCreditMemoSchema,
  BillingUsageEventInputSchema,
  BillingUsageEventsResultSchema,
  BillingUsageResolutionValues,
  BillingUsageSourceValues,
  BillingInvoiceStatusValues,
  BillingCreditReasonValues,
  type PortalPermission
} from "@ma/contracts";
import type {
  SuperAdminOrganizationRoleUpdateRequest,
  SuperAdminTenantRoleUpdateRequest,
  SuperAdminEntitlementGrantRequest,
  SuperAdminEntitlementRevokeRequest,
  SuperAdminUserStatusUpdateRequest,
  SuperAdminUserListQuery,
  SuperAdminImpersonationRequest,
  SuperAdminImpersonationResponse,
  SuperAdminBulkJobCreateRequest,
  SuperAdminBulkJobUpdateRequest,
  SuperAdminBulkJob,
  SuperAdminBulkJobsResponse,
  SuperAdminAuditLogResponse,
  SuperAdminAuditLogQuery,
  SuperAdminAuditExportResponse,
  SuperAdminImpersonationCleanupResponse,
  TasksUsersResponse,
  SuperAdminUsersResponse,
  SuperAdminUserDetail,
  PortalBillingOverviewResponse,
  PortalBillingUsageResponse,
  PortalBillingSubscriptionChangeRequest,
  PortalBillingSubscriptionChangeResponse,
  PortalBillingSubscriptionCancelRequest,
  PortalBillingContactsResponse,
  PortalBillingPaymentMethodsResponse,
  PortalBillingInvoiceListResponse,
  BillingUsageQuery,
  PortalBillingPaymentMethodUpsertRequest,
  PortalBillingSetDefaultPaymentMethodRequest,
  PortalBillingContactsUpdateRequest,
  AdminBillingCatalogResponse,
  AdminBillingPackageCreateRequest,
  AdminBillingPackageUpdateRequest,
  AdminBillingSubscriptionListResponse,
  AdminBillingInvoiceListResponse,
  AdminBillingUsageQuery,
  AdminBillingUsageResponse,
  AdminBillingInvoiceStatusUpdateRequest,
  AdminBillingCreditIssueRequest,
  AdminBillingCreditListResponse,
  BillingPackage,
  BillingInvoice,
  BillingCreditMemo,
  BillingUsageEventInput,
  BillingUsageEventsResult
} from "@ma/contracts";

const resolveIdentityBaseUrl = (): string =>
  process.env.IDENTITY_BASE_URL ??
  process.env.NEXT_PUBLIC_IDENTITY_BASE_URL ??
  "http://localhost:3100";

const buildHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json"
});

const MAX_USAGE_EVENT_BATCH_SIZE = 50;

type NormalizedBillingUsageEvent = {
  organizationId: string;
  subscriptionId?: string;
  tenantId?: string;
  productId?: string;
  featureKey: string;
  quantity: number;
  unit: string;
  recordedAt?: string;
  source: string;
  metadata: Record<string, unknown> | null;
  fingerprint?: string;
};

const normalizeBillingUsageEvent = (event: BillingUsageEventInput): NormalizedBillingUsageEvent => {
  const parsed = BillingUsageEventInputSchema.parse(event);
  const numericQuantity =
    typeof parsed.quantity === "string" ? Number(parsed.quantity) : parsed.quantity;

  if (!Number.isFinite(numericQuantity)) {
    throw new Error(`Billing usage quantity must be numeric (received "${parsed.quantity}")`);
  }

  const recordedAt =
    parsed.recordedAt instanceof Date
      ? parsed.recordedAt.toISOString()
      : parsed.recordedAt ?? undefined;

  return {
    organizationId: parsed.organizationId,
    subscriptionId: parsed.subscriptionId ?? undefined,
    tenantId: parsed.tenantId ?? undefined,
    productId: parsed.productId ?? undefined,
    featureKey: parsed.featureKey,
    quantity: numericQuantity,
    unit: parsed.unit,
    recordedAt,
    source: parsed.source ?? "API",
    metadata: parsed.metadata ?? null,
    fingerprint: parsed.fingerprint ?? undefined
  };
};

const chunkArray = <T,>(values: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than zero");
  }
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    result.push(values.slice(index, index + chunkSize));
  }
  return result;
};

export const emitBillingUsageEvents = async (
  accessToken: string,
  events: BillingUsageEventInput[],
  options?: { batchSize?: number }
): Promise<BillingUsageEventsResult> => {
  if (events.length === 0) {
    return { accepted: 0 };
  }

  const normalizedEvents = events.map(normalizeBillingUsageEvent);
  const batchSize = Math.max(
    1,
    Math.min(options?.batchSize ?? MAX_USAGE_EVENT_BATCH_SIZE, MAX_USAGE_EVENT_BATCH_SIZE)
  );

  let accepted = 0;

  for (const batch of chunkArray(normalizedEvents, batchSize)) {
    const response = await fetch(`${resolveIdentityBaseUrl()}/internal/billing/usage/events`, {
      method: "POST",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify({ events: batch })
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(
        payload?.error ?? `Failed to emit billing usage events (${response.status})`
      );
    }

    const parsed = BillingUsageEventsResultSchema.parse(payload);
    accepted += parsed.accepted;
  }

  return BillingUsageEventsResultSchema.parse({ accepted });
};

const BillingUsageAggregationRequestSchema = z.object({
  organizationId: z.string().min(1),
  subscriptionId: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  resolution: z.enum(BillingUsageResolutionValues).default("DAILY"),
  source: z.enum(BillingUsageSourceValues).default("WORKER"),
  featureKeys: z.array(z.string().min(1)).optional(),
  backfill: z.boolean().optional(),
  context: z.record(z.any()).optional()
});

const BillingUsageAggregationResponseSchema = z.object({
  aggregated: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative()
});

export type BillingUsageAggregationRequest = z.infer<
  typeof BillingUsageAggregationRequestSchema
>;
export type BillingUsageAggregationResponse = z.infer<
  typeof BillingUsageAggregationResponseSchema
>;

export const aggregateBillingUsage = async (
  accessToken: string,
  input: BillingUsageAggregationRequest
): Promise<BillingUsageAggregationResponse> => {
  const payload = BillingUsageAggregationRequestSchema.parse(input);
  const response = await fetch(`${resolveIdentityBaseUrl()}/internal/billing/usage/aggregate`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(payload)
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error ?? `Failed to aggregate billing usage (${response.status})`);
  }

  return BillingUsageAggregationResponseSchema.parse(json);
};

const BillingInvoiceJobRequestSchema = z.object({
  organizationId: z.string().min(1),
  subscriptionId: z.string().min(1).optional(),
  invoiceNumber: z.string().min(1).optional(),
  currency: z.string().min(3).default("usd"),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  recurringAmountCents: z.number().int().nonnegative().optional(),
  recurringDescription: z.string().optional(),
  status: z.enum(BillingInvoiceStatusValues).default("OPEN"),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  taxCents: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
  usageCharges: z
    .array(
      z.object({
        featureKey: z.string().min(1),
        unitAmountCents: z.number().int().nonnegative(),
        unit: z.string().min(1),
        description: z.string().optional(),
        minimumAmountCents: z.number().int().nonnegative().optional(),
        resolution: z.enum(BillingUsageResolutionValues).default("DAILY"),
        usagePeriodStart: z.string().datetime().optional(),
        usagePeriodEnd: z.string().datetime().optional()
      })
    )
    .default([]),
  extraLines: z
    .array(
      z.object({
        lineType: z.enum(BillingInvoiceLineTypeValues).default("ADJUSTMENT"),
        description: z.string().optional(),
        featureKey: z.string().optional(),
        quantity: z.number().finite().default(1),
        unitAmountCents: z.number().int(),
        amountCents: z.number().int(),
        usagePeriodStart: z.string().datetime().optional(),
        usagePeriodEnd: z.string().datetime().optional(),
        metadata: z.record(z.any()).optional()
      })
    )
    .default([]),
  settle: z
    .object({
      amountCents: z.number().int().nonnegative().optional(),
      paidAt: z.string().datetime().optional()
    })
    .optional()
});

const BillingInvoiceJobResponseSchema = z.object({
  invoiceId: z.string(),
  status: z.enum(BillingInvoiceStatusValues),
  subtotalCents: z.number().int(),
  taxCents: z.number().int(),
  totalCents: z.number().int(),
  lineCount: z.number().int(),
  durationMs: z.number().nonnegative()
});

export type BillingInvoiceJobRequest = z.infer<typeof BillingInvoiceJobRequestSchema>;
export type BillingInvoiceJobResponse = z.infer<typeof BillingInvoiceJobResponseSchema>;

export const createBillingInvoice = async (
  accessToken: string,
  input: BillingInvoiceJobRequest
): Promise<BillingInvoiceJobResponse> => {
  const payload = BillingInvoiceJobRequestSchema.parse(input);
  const response = await fetch(`${resolveIdentityBaseUrl()}/internal/billing/invoices`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(payload)
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error ?? `Failed to process billing invoice (${response.status})`);
  }

  return BillingInvoiceJobResponseSchema.parse(json);
};

const paymentSyncEvents = [
  "payment_succeeded",
  "payment_failed",
  "payment_disputed",
  "payment_refunded",
  "sync_status"
] as const;

const BillingPaymentSyncRequestSchema = z.object({
  organizationId: z.string().min(1),
  invoiceId: z.string().min(1),
  event: z.enum(paymentSyncEvents),
  amountCents: z.number().int().nonnegative().optional(),
  paidAt: z.string().datetime().optional(),
  status: z.enum(BillingInvoiceStatusValues).optional(),
  externalPaymentId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  note: z.string().optional(),
  credit: z
    .object({
      amountCents: z.number().int().nonnegative(),
      reason: z.enum(BillingCreditReasonValues).optional(),
      metadata: z.record(z.any()).optional()
    })
    .optional()
});

const BillingPaymentSyncResponseSchema = z.object({
  invoiceId: z.string(),
  status: z.enum(BillingInvoiceStatusValues),
  action: z.enum(["PAYMENT_RECORDED", "STATUS_UPDATED", "CREDIT_ISSUED"]),
  durationMs: z.number().nonnegative()
});

export type BillingPaymentSyncRequest = z.infer<typeof BillingPaymentSyncRequestSchema>;
export type BillingPaymentSyncResponse = z.infer<typeof BillingPaymentSyncResponseSchema>;

export const syncBillingPayment = async (
  accessToken: string,
  input: BillingPaymentSyncRequest
): Promise<BillingPaymentSyncResponse> => {
  const payload = BillingPaymentSyncRequestSchema.parse(input);
  const response = await fetch(`${resolveIdentityBaseUrl()}/internal/billing/payment-sync`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(payload)
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error ?? `Failed to synchronize billing payment (${response.status})`);
  }

  return BillingPaymentSyncResponseSchema.parse(json);
};

export const fetchSuperAdminUsers = async (
  accessToken: string,
  query?: Partial<SuperAdminUserListQuery>
): Promise<SuperAdminUsersResponse> => {
  const params = new URLSearchParams();
  if (query?.search) {
    params.set("search", query.search);
  }
  if (query?.status) {
    params.set("status", query.status);
  }
  if (query?.page) {
    params.set("page", String(query.page));
  }
  if (query?.pageSize) {
    params.set("pageSize", String(query.pageSize));
  }

  const url =
    params.size > 0
      ? `${resolveIdentityBaseUrl()}/super-admin/users?${params.toString()}`
      : `${resolveIdentityBaseUrl()}/super-admin/users`;

  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch super admin users (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminUsersResponseSchema.parse(json);
};

export const fetchSuperAdminUserDetail = async (
  accessToken: string,
  userId: string,
  verifiedEmail?: string
): Promise<SuperAdminUserDetail> => {
  const baseUrl = `${resolveIdentityBaseUrl()}/super-admin/users/${encodeURIComponent(userId)}`;
  const url = verifiedEmail ? `${baseUrl}?verifiedEmail=${encodeURIComponent(verifiedEmail)}` : baseUrl;

  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch user detail (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminUserDetailSchema.parse(json);
};

export const updateSuperAdminOrganizationRole = async (
  accessToken: string,
  userId: string,
  organizationId: string,
  input: SuperAdminOrganizationRoleUpdateRequest
): Promise<SuperAdminUserDetail> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/users/${encodeURIComponent(
      userId
    )}/organizations/${encodeURIComponent(organizationId)}`,
    {
      method: "PATCH",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(SuperAdminOrganizationRoleUpdateRequestSchema.parse(input))
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update organization role (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminUserDetailSchema.parse(json);
};

export const updateSuperAdminTenantRole = async (
  accessToken: string,
  userId: string,
  organizationId: string,
  tenantId: string,
  input: SuperAdminTenantRoleUpdateRequest
): Promise<SuperAdminUserDetail> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/users/${encodeURIComponent(
      userId
    )}/organizations/${encodeURIComponent(organizationId)}/tenants/${encodeURIComponent(tenantId)}`,
    {
      method: "PATCH",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(SuperAdminTenantRoleUpdateRequestSchema.parse(input))
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update tenant role (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminUserDetailSchema.parse(json);
};

export const grantSuperAdminEntitlement = async (
  accessToken: string,
  userId: string,
  input: SuperAdminEntitlementGrantRequest
): Promise<SuperAdminUserDetail> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/users/${encodeURIComponent(userId)}/entitlements`,
    {
      method: "POST",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(input)
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to grant entitlement (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminUserDetailSchema.parse(json);
};

export const revokeSuperAdminEntitlement = async (
  accessToken: string,
  userId: string,
  input: SuperAdminEntitlementRevokeRequest
): Promise<SuperAdminUserDetail> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/users/${encodeURIComponent(userId)}/entitlements`,
    {
      method: "DELETE",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(input)
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to revoke entitlement (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminUserDetailSchema.parse(json);
};

export const updateSuperAdminUserStatus = async (
  accessToken: string,
  userId: string,
  input: SuperAdminUserStatusUpdateRequest
): Promise<SuperAdminUserDetail> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/users/${encodeURIComponent(userId)}/status`,
    {
      method: "PATCH",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(SuperAdminUserStatusUpdateRequestSchema.parse(input))
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update user status (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminUserDetailSchema.parse(json);
};

export const createSuperAdminImpersonationSession = async (
  accessToken: string,
  userId: string,
  input: SuperAdminImpersonationRequest
): Promise<SuperAdminImpersonationResponse> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/users/${encodeURIComponent(userId)}/impersonation`,
    {
      method: "POST",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(SuperAdminImpersonationRequestSchema.parse(input))
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to create impersonation session (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminImpersonationResponseSchema.parse(json);
};

export const deleteSuperAdminImpersonationSession = async (
  accessToken: string,
  userId: string,
  tokenId: string
): Promise<void> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/users/${encodeURIComponent(userId)}/impersonation/${encodeURIComponent(tokenId)}`,
    {
      method: "DELETE",
      headers: buildHeaders(accessToken),
      cache: "no-store"
    }
  );

  if (!response.ok && response.status !== 404) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to stop impersonation session (${response.status})`);
  }
};

export const cleanupSuperAdminImpersonationSessions = async (
  accessToken: string
): Promise<SuperAdminImpersonationCleanupResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/impersonation/cleanup`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to cleanup impersonation sessions (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminImpersonationCleanupResponseSchema.parse(json);
};

export const createSuperAdminBulkJob = async (
  accessToken: string,
  input: SuperAdminBulkJobCreateRequest
): Promise<SuperAdminBulkJob> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/bulk-jobs`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(SuperAdminBulkJobCreateRequestSchema.parse(input))
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to create bulk job (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminBulkJobSchema.parse(json);
};

export const updateSuperAdminBulkJob = async (
  accessToken: string,
  jobId: string,
  input: SuperAdminBulkJobUpdateRequest
): Promise<SuperAdminBulkJob> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/bulk-jobs/${encodeURIComponent(jobId)}`,
    {
      method: "PATCH",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(SuperAdminBulkJobUpdateRequestSchema.parse(input))
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update bulk job (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminBulkJobSchema.parse(json);
};

export const fetchSuperAdminBulkJobs = async (
  accessToken: string
): Promise<SuperAdminBulkJobsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/bulk-jobs`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch bulk jobs (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminBulkJobsResponseSchema.parse(json);
};

export const fetchSuperAdminAuditLogs = async (
  accessToken: string,
  query?: Partial<SuperAdminAuditLogQuery>
): Promise<SuperAdminAuditLogResponse> => {
  const params = new URLSearchParams();
  if (query?.search) params.set("search", query.search);
  if (query?.actorEmail) params.set("actorEmail", query.actorEmail);
  if (query?.eventType) params.set("eventType", query.eventType);
  if (query?.page) params.set("page", String(query.page));
  if (query?.pageSize) params.set("pageSize", String(query.pageSize));
  if (query?.start) params.set("start", query.start);
  if (query?.end) params.set("end", query.end);

  const queryString = params.toString();
  const response = await fetch(
    queryString
      ? `${resolveIdentityBaseUrl()}/super-admin/audit/logs?${queryString}`
      : `${resolveIdentityBaseUrl()}/super-admin/audit/logs`,
    {
      headers: buildHeaders(accessToken),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch audit logs (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminAuditLogResponseSchema.parse(json);
};

export const createSuperAdminAuditExport = async (
  accessToken: string,
  query?: Partial<SuperAdminAuditLogQuery>
): Promise<SuperAdminAuditExportResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/audit/export`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(query ? SuperAdminAuditLogQuerySchema.partial().parse(query) : {})
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to create audit export (${response.status})`);
  }

  const json = await response.json();
  return SuperAdminAuditExportResponseSchema.parse(json);
};

export const fetchPortalLauncher = async (accessToken: string) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/launcher`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch launcher data: ${response.status}`);
  }

  const json = await response.json();
  return PortalLauncherResponseSchema.parse(json);
};

export const fetchPortalPermissions = async (accessToken: string) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/permissions`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch portal permissions: ${response.status}`);
  }

  const json = await response.json();
  return PortalPermissionsResponseSchema.parse(json);
};

export const updatePortalRolePermissions = async (
  accessToken: string,
  role: string,
  permissions: PortalPermission[]
) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/permissions/${encodeURIComponent(role)}`, {
    method: "PATCH",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify({ permissions })
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update portal permissions (${response.status})`);
  }

  const json = await response.json();
  return PortalRolePermissionsSchema.parse(json);
};

export const fetchPortalBillingOverview = async (
  accessToken: string
): Promise<PortalBillingOverviewResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/overview`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch billing overview (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingOverviewResponseSchema.parse(json);
};

export const fetchPortalBillingUsage = async (
  accessToken: string,
  query?: Partial<BillingUsageQuery>
): Promise<PortalBillingUsageResponse> => {
  const parsedQuery = query ? BillingUsageQuerySchema.parse(query) : {};
  const params = new URLSearchParams();
  if (parsedQuery.featureKey) params.set("featureKey", parsedQuery.featureKey);
  if (parsedQuery.from) params.set("from", parsedQuery.from);
  if (parsedQuery.to) params.set("to", parsedQuery.to);
  if (parsedQuery.resolution) params.set("resolution", parsedQuery.resolution);
  if (parsedQuery.tenantId) params.set("tenantId", parsedQuery.tenantId);
  if (parsedQuery.productId) params.set("productId", parsedQuery.productId);

  const url =
    params.size > 0
      ? `${resolveIdentityBaseUrl()}/portal/billing/usage?${params.toString()}`
      : `${resolveIdentityBaseUrl()}/portal/billing/usage`;

  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch billing usage (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingUsageResponseSchema.parse(json);
};

export const changePortalBillingSubscription = async (
  accessToken: string,
  input: PortalBillingSubscriptionChangeRequest
): Promise<PortalBillingSubscriptionChangeResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/subscription/change`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(PortalBillingSubscriptionChangeRequestSchema.parse(input))
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to change subscription (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingSubscriptionChangeResponseSchema.parse(json);
};

export const cancelPortalBillingSubscription = async (
  accessToken: string,
  input?: PortalBillingSubscriptionCancelRequest
): Promise<PortalBillingSubscriptionChangeResponse> => {
  const payload = PortalBillingSubscriptionCancelRequestSchema.parse(
    input ?? { cancelAtPeriodEnd: true }
  );

  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/subscription/cancel`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to cancel subscription (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingSubscriptionChangeResponseSchema.parse(json);
};

export const fetchPortalBillingInvoices = async (
  accessToken: string
): Promise<PortalBillingInvoiceListResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/invoices`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch invoices (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingInvoiceListResponseSchema.parse(json);
};

export const fetchPortalBillingContacts = async (
  accessToken: string
): Promise<PortalBillingContactsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/contacts`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch billing contacts (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingContactsResponseSchema.parse(json);
};

export const updatePortalBillingContacts = async (
  accessToken: string,
  input: PortalBillingContactsUpdateRequest
): Promise<PortalBillingContactsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/contacts`, {
    method: "PATCH",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(PortalBillingContactsUpdateRequestSchema.parse(input))
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update billing contacts (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingContactsResponseSchema.parse(json);
};

export const fetchPortalBillingPaymentMethods = async (
  accessToken: string
): Promise<PortalBillingPaymentMethodsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/payment-methods`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch payment methods (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingPaymentMethodsResponseSchema.parse(json);
};

export const upsertPortalBillingPaymentMethod = async (
  accessToken: string,
  input: PortalBillingPaymentMethodUpsertRequest
): Promise<PortalBillingPaymentMethodsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/payment-methods`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(PortalBillingPaymentMethodUpsertRequestSchema.parse(input))
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to save payment method (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingPaymentMethodsResponseSchema.parse(json);
};

export const setPortalDefaultBillingPaymentMethod = async (
  accessToken: string,
  input: PortalBillingSetDefaultPaymentMethodRequest
): Promise<PortalBillingPaymentMethodsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/payment-methods/default`, {
    method: "PATCH",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(PortalBillingSetDefaultPaymentMethodRequestSchema.parse(input))
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to set default payment method (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingPaymentMethodsResponseSchema.parse(json);
};

export const deletePortalBillingPaymentMethod = async (
  accessToken: string,
  paymentMethodId: string
): Promise<PortalBillingPaymentMethodsResponse> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/portal/billing/payment-methods/${encodeURIComponent(paymentMethodId)}`,
    {
      method: "DELETE",
      headers: buildHeaders(accessToken),
      cache: "no-store"
    }
  );

  if (response.status === 204) {
    return fetchPortalBillingPaymentMethods(accessToken);
  }

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to remove payment method (${response.status})`);
  }

  const json = await response.json();
  return PortalBillingPaymentMethodsResponseSchema.parse(json);
};

export const revokeIdentitySession = async (accessToken: string, sessionId: string) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/sessions/${sessionId}`, {
    method: "DELETE",
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to revoke session: ${response.status}`);
  }
};

interface CreateTenantInput {
  name: string;
  description?: string | null;
  organizationId: string;
}

export const createTenant = async (accessToken: string, input: CreateTenantInput) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/organizations/${input.organizationId}/tenants`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    body: JSON.stringify({
      name: input.name,
      description: input.description
    })
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to create tenant (${response.status})`);
  }

  return response.json();
};

interface CreateOrganizationInput {
  name: string;
  slug?: string;
  defaultTenantName?: string;
}

export const createOrganization = async (accessToken: string, input: CreateOrganizationInput) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/organizations`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to create organization (${response.status})`);
  }

  return response.json();
};

interface CreateOrganizationInvitationInput {
  organizationId: string;
  email: string;
  role: string;
  tenantId?: string;
  tenantRoles?: string[];
  productIds?: string[];
  expiresInHours?: number;
}

export const createOrganizationInvitation = async (
  accessToken: string,
  input: CreateOrganizationInvitationInput
) => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/admin/organizations/${input.organizationId}/invitations`,
    {
      method: "POST",
      headers: buildHeaders(accessToken),
      body: JSON.stringify({
        email: input.email,
        role: input.role,
        tenantId: input.tenantId,
        tenantRoles: input.tenantRoles,
        productIds: input.productIds,
        expiresInHours: input.expiresInHours
      })
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to create invitation (${response.status})`);
  }

  return response.json();
};

interface UpdateOrganizationInput {
  name: string;
  slug?: string | null;
}

export const updateOrganization = async (
  accessToken: string,
  organizationId: string,
  input: UpdateOrganizationInput
) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/organizations/${organizationId}`, {
    method: "PATCH",
    headers: buildHeaders(accessToken),
    body: JSON.stringify({
      name: input.name,
      slug: input.slug ?? undefined
    })
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update organization (${response.status})`);
  }

  return response.json();
};

export const deleteOrganizationInvitation = async (
  accessToken: string,
  organizationId: string,
  invitationId: string
): Promise<void> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/admin/organizations/${organizationId}/invitations/${invitationId}`,
    {
      method: "DELETE",
      headers: buildHeaders(accessToken)
    }
  );

  if (!response.ok && response.status !== 204) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to delete invitation (${response.status})`);
  }
};

export const updateTenant = async (
  accessToken: string,
  tenantId: string,
  input: { name: string; description?: string | null }
) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/tenants/${tenantId}`, {
    method: "PATCH",
    headers: buildHeaders(accessToken),
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? null
    })
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update tenant (${response.status})`);
  }

  return response.json();
};

export const deleteTenant = async (accessToken: string, tenantId: string): Promise<void> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/tenants/${tenantId}`, {
    method: "DELETE",
    headers: buildHeaders(accessToken)
  });

  if (!response.ok && response.status !== 204) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to delete tenant (${response.status})`);
  }
};

interface GrantTenantProductInput {
  organizationId: string;
  tenantId: string;
  productId: string;
  userId: string;
}

export const grantTenantProduct = async (
  accessToken: string,
  input: GrantTenantProductInput
) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/tenants/${input.tenantId}/entitlements`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    body: JSON.stringify({
      organizationId: input.organizationId,
      productId: input.productId,
      userId: input.userId
    })
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to enable product (${response.status})`);
  }

  return response.json();
};

export const enableTenantApp = async (
  accessToken: string,
  tenantId: string,
  productId: string
) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/tenants/${tenantId}/apps`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    body: JSON.stringify({ productId })
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to enable app (${response.status})`);
  }

  return response.json();
};

export const disableTenantApp = async (
  accessToken: string,
  tenantId: string,
  productId: string
): Promise<void> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/tenants/${tenantId}/apps/${productId}`, {
    method: "DELETE",
    headers: buildHeaders(accessToken)
  });

  if (!response.ok && response.status !== 204) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to disable app (${response.status})`);
  }
};

interface OrganizationProductSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  launcherUrl: string | null;
}

interface OrganizationProductResponse {
  products: OrganizationProductSummary[];
  entitlements: Array<{
    id: string;
    organizationId: string;
    tenantId: string;
    productId: string;
    userId: string;
    roles: string[];
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export const fetchOrganizationProducts = async (
  accessToken: string,
  organizationId: string
): Promise<OrganizationProductResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/organizations/${organizationId}/products`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to load products (${response.status})`);
  }

  const json = (await response.json()) as OrganizationProductResponse;
  return json;
};

export const fetchAdminBillingCatalog = async (
  accessToken: string
): Promise<AdminBillingCatalogResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/billing/packages`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch billing catalog (${response.status})`);
  }

  const json = await response.json();
  return AdminBillingCatalogResponseSchema.parse(json);
};

export const createAdminBillingPackage = async (
  accessToken: string,
  input: AdminBillingPackageCreateRequest
): Promise<BillingPackage> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/billing/packages`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify(AdminBillingPackageCreateRequestSchema.parse(input))
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to create billing package (${response.status})`);
  }

  const json = await response.json();
  return BillingPackageSchema.parse(json);
};

export const updateAdminBillingPackage = async (
  accessToken: string,
  packageId: string,
  input: AdminBillingPackageUpdateRequest
): Promise<BillingPackage> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/billing/packages/${encodeURIComponent(packageId)}`,
    {
      method: "PATCH",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(AdminBillingPackageUpdateRequestSchema.parse(input))
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update billing package (${response.status})`);
  }

  const json = await response.json();
  return BillingPackageSchema.parse(json);
};

export const fetchAdminBillingSubscriptions = async (
  accessToken: string,
  params?: { organizationId?: string; status?: string }
): Promise<AdminBillingSubscriptionListResponse> => {
  const search = new URLSearchParams();
  if (params?.organizationId) search.set("organizationId", params.organizationId);
  if (params?.status) search.set("status", params.status);

  const url =
    search.size > 0
      ? `${resolveIdentityBaseUrl()}/super-admin/billing/subscriptions?${search.toString()}`
      : `${resolveIdentityBaseUrl()}/super-admin/billing/subscriptions`;

  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch billing subscriptions (${response.status})`);
  }

  const json = await response.json();
  return AdminBillingSubscriptionListResponseSchema.parse(json);
};

export const fetchAdminBillingInvoices = async (
  accessToken: string,
  params?: { organizationId?: string; status?: string }
): Promise<AdminBillingInvoiceListResponse> => {
  const search = new URLSearchParams();
  if (params?.organizationId) search.set("organizationId", params.organizationId);
  if (params?.status) search.set("status", params.status);

  const url =
    search.size > 0
      ? `${resolveIdentityBaseUrl()}/super-admin/billing/invoices?${search.toString()}`
      : `${resolveIdentityBaseUrl()}/super-admin/billing/invoices`;

  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch billing invoices (${response.status})`);
  }

  const json = await response.json();
  return AdminBillingInvoiceListResponseSchema.parse(json);
};

export const updateAdminBillingInvoiceStatus = async (
  accessToken: string,
  invoiceId: string,
  input: AdminBillingInvoiceStatusUpdateRequest
): Promise<BillingInvoice> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/billing/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: "PATCH",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(AdminBillingInvoiceStatusUpdateRequestSchema.parse(input))
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update invoice (${response.status})`);
  }

  const json = await response.json();
  return BillingInvoiceSchema.parse(json);
};

export const fetchAdminBillingUsage = async (
  accessToken: string,
  query?: Partial<AdminBillingUsageQuery>
): Promise<AdminBillingUsageResponse> => {
  const parsed = query ? AdminBillingUsageQuerySchema.parse(query) : {};
  const params = new URLSearchParams();
  if (parsed.featureKey) params.set("featureKey", parsed.featureKey);
  if (parsed.from) params.set("from", parsed.from);
  if (parsed.to) params.set("to", parsed.to);
  if (parsed.resolution) params.set("resolution", parsed.resolution);
  if (parsed.organizationId) params.set("organizationId", parsed.organizationId);
  if (parsed.tenantId) params.set("tenantId", parsed.tenantId);
  if (parsed.productId) params.set("productId", parsed.productId);

  const url =
    params.size > 0
      ? `${resolveIdentityBaseUrl()}/super-admin/billing/usage?${params.toString()}`
      : `${resolveIdentityBaseUrl()}/super-admin/billing/usage`;

  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch billing usage (${response.status})`);
  }

  const json = await response.json();
  return AdminBillingUsageResponseSchema.parse(json);
};

export const issueAdminBillingCredit = async (
  accessToken: string,
  organizationId: string,
  input: AdminBillingCreditIssueRequest
): Promise<BillingCreditMemo> => {
  const params = new URLSearchParams();
  if (organizationId) {
    params.set("organizationId", organizationId);
  }

  const response = await fetch(
    `${resolveIdentityBaseUrl()}/super-admin/billing/credits${
      params.size > 0 ? `?${params.toString()}` : ""
    }`,
    {
      method: "POST",
      headers: buildHeaders(accessToken),
      cache: "no-store",
      body: JSON.stringify(AdminBillingCreditIssueRequestSchema.parse(input))
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to issue credit (${response.status})`);
  }

  const json = await response.json();
  return BillingCreditMemoSchema.parse(json);
};

export const fetchAdminBillingCredits = async (
  accessToken: string,
  organizationId?: string
): Promise<AdminBillingCreditListResponse> => {
  const url = organizationId
    ? `${resolveIdentityBaseUrl()}/super-admin/billing/credits?organizationId=${encodeURIComponent(organizationId)}`
    : `${resolveIdentityBaseUrl()}/super-admin/billing/credits`;

  const response = await fetch(url, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to fetch credits (${response.status})`);
  }

  const json = await response.json();
  return AdminBillingCreditListResponseSchema.parse(json);
};

interface InvitationPreviewResponse {
  invitation: {
    id: string;
    organizationId: string;
    organizationName: string;
    email: string;
    role: string;
    status: string;
    expiresAt: string;
    tenantId: string | null;
    tenantName: string | null;
    tokenHint: string | null;
  } | null;
}

export const previewOrganizationInvitation = async (token: string): Promise<InvitationPreviewResponse> => {
  const params = new URLSearchParams({ token });
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/portal/invitations/preview?${params.toString()}`,
    {
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to preview invitation (${response.status})`);
  }

  return (await response.json()) as InvitationPreviewResponse;
};

interface InvitationAcceptanceResponse {
  status: "accepted";
  invitation: InvitationPreviewResponse["invitation"];
  organizationMember: {
    id: string;
    role: string;
  };
  tenantMembership: {
    id: string;
    tenantId: string;
    role: string;
  } | null;
}

export const acceptOrganizationInvitation = async (
  accessToken: string,
  token: string
): Promise<InvitationAcceptanceResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/invitations/accept`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store",
    body: JSON.stringify({ token })
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to accept invitation (${response.status})`);
  }

  return (await response.json()) as InvitationAcceptanceResponse;
};

interface OrganizationMemberSummary {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  user: {
    email: string;
    fullName: string | null;
  };
}

interface OrganizationInvitationSummary {
  id: string;
  organizationId: string;
  tenantId: string | null;
  email: string;
  role: string;
  status: string;
  tokenHint: string | null;
  issuedIp: string | null;
  acceptedIp: string | null;
  acceptedAt: string | null;
  invitedById: string;
  productIds: string[];
  tenantRoles: string[];
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationDetailResponse {
  organizationId: string;
  tenants: Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;
  members: OrganizationMemberSummary[];
  invitations: OrganizationInvitationSummary[];
}

export const fetchOrganizationDetail = async (
  accessToken: string,
  organizationId: string
): Promise<OrganizationDetailResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/organizations/${organizationId}`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to load organization (${response.status})`);
  }

  return (await response.json()) as OrganizationDetailResponse;
};

export const deleteOrganizationMember = async (
  accessToken: string,
  organizationId: string,
  organizationMemberId: string
) => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/admin/organizations/${organizationId}/members/${organizationMemberId}`,
    {
      method: "DELETE",
      headers: buildHeaders(accessToken),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to remove member (${response.status})`);
  }
};

export const deleteOrganization = async (accessToken: string, organizationId: string) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/organizations/${organizationId}`, {
    method: "DELETE",
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to delete organization (${response.status})`);
  }
};

export interface TenantDetailResponse {
  tenant: {
    id: string;
    organizationId: string;
    name: string;
    slug: string | null;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
  members: Array<{
    id: string;
    tenantId: string;
    organizationMemberId: string;
    role: string;
    createdAt: string;
    updatedAt: string;
    organizationMember: {
      id: string;
      userId: string;
      role: string;
      user: {
        email: string;
        fullName: string;
      };
    };
  }>;
  organizationMembers: Array<{
    id: string;
    userId: string;
    role: string;
    createdAt: string;
    updatedAt: string;
    user: {
      email: string;
      fullName: string;
    };
  }>;
  applications: Array<{
    id: string;
    tenantId: string;
    productId: string;
    environment: string;
    consentRequired: boolean;
    createdAt: string;
    updatedAt: string;
    product: {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      iconUrl: string | null;
      launcherUrl: string | null;
    };
  }>;
  entitlements: Array<{
    id: string;
    organizationId: string;
    tenantId: string;
    productId: string;
    userId: string;
    roles: string[];
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export const fetchTenantDetail = async (
  accessToken: string,
  tenantId: string
): Promise<TenantDetailResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/tenants/${tenantId}`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to load tenant (${response.status})`);
  }

  return (await response.json()) as TenantDetailResponse;
};

export const addTenantMember = async (
  accessToken: string,
  input: { tenantId: string; organizationMemberId: string; role: string }
): Promise<void> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/tenants/${input.tenantId}/members`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    body: JSON.stringify({
      organizationMemberId: input.organizationMemberId,
      role: input.role
    })
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to add tenant member (${response.status})`);
  }
};

export const updateTenantMemberRole = async (
  accessToken: string,
  input: { tenantId: string; organizationMemberId: string; role: string }
): Promise<void> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/admin/tenants/${input.tenantId}/members/${input.organizationMemberId}`,
    {
      method: "PATCH",
      headers: buildHeaders(accessToken),
      body: JSON.stringify({
        role: input.role
      })
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to update tenant member (${response.status})`);
  }
};

export const removeTenantMember = async (
  accessToken: string,
  input: { tenantId: string; organizationMemberId: string }
): Promise<void> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/admin/tenants/${input.tenantId}/members/${input.organizationMemberId}`,
    {
      method: "DELETE",
      headers: buildHeaders(accessToken)
    }
  );

  if (!response.ok && response.status !== 204) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to remove tenant member (${response.status})`);
  }
};

export const revokeTenantEntitlement = async (
  accessToken: string,
  input: { tenantId: string; entitlementId: string }
): Promise<void> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/admin/tenants/${input.tenantId}/entitlements/${input.entitlementId}`,
    {
      method: "DELETE",
      headers: buildHeaders(accessToken)
    }
  );

  if (!response.ok && response.status !== 204) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to revoke tenant entitlement (${response.status})`);
  }
};

export interface FetchTasksContextOptions {
  productSlug?: string;
  tenantId?: string;
}

export interface FetchTasksUsersOptions {
  userIds?: string[];
  productSlug?: string;
  tenantId?: string;
}

export const fetchTasksContext = async (
  accessToken: string,
  options?: FetchTasksContextOptions
) => {
  const params = new URLSearchParams();
  if (options?.productSlug) {
    params.set("productSlug", options.productSlug);
  }
  if (options?.tenantId) {
    params.set("tenantId", options.tenantId);
  }

  const queryString = params.toString();
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/internal/tasks/context${queryString ? `?${queryString}` : ""}`,
    {
      headers: buildHeaders(accessToken),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    const detail = json?.error ? `: ${json.error}` : "";
    throw new Error(`Failed to fetch tasks context (${response.status})${detail}`);
  }

  const json = await response.json();
  return TasksContextResponseSchema.parse(json);
};

export const fetchTasksUsers = async (
  accessToken: string,
  options: FetchTasksUsersOptions
): Promise<TasksUsersResponse> => {
  const uniqueIds = Array.isArray(options.userIds) ? Array.from(new Set(options.userIds)) : [];

  const params = new URLSearchParams();
  for (const id of uniqueIds) {
    params.append("userId", id);
  }
  if (options.productSlug) {
    params.set("productSlug", options.productSlug);
  }
  if (options.tenantId) {
    params.set("tenantId", options.tenantId);
  }

  const queryString = params.toString();
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/internal/tasks/users${queryString ? `?${queryString}` : ""}`,
    {
      headers: buildHeaders(accessToken),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    const detail = json?.error ? `: ${json.error}` : "";
    throw new Error(`Failed to fetch tasks users (${response.status})${detail}`);
  }

  const json = await response.json();
  return TasksUsersResponseSchema.parse(json);
};
const resolveTasksStatusUrl = (): string => {
  const explicit =
    process.env.TASKS_STATUS_URL ?? process.env.NEXT_PUBLIC_TASKS_STATUS_URL ?? process.env.TASKS_API_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const fallbackBase = process.env.TASKS_APP_URL ?? process.env.NEXT_PUBLIC_TASKS_APP_URL ?? "http://localhost:3300";
  return `${fallbackBase.replace(/\/$/, "")}/api/status`;
};

interface ServiceStatus {
  status: string;
  latency: number | null;
}

const fetchWithLatency = async (url: string, init?: RequestInit): Promise<ServiceStatus> => {
  const start = Date.now();
  try {
    const response = await fetch(url, init);
    const latency = Date.now() - start;
    if (!response.ok) {
      return { status: `error (${response.status})`, latency };
    }
    const json = (await response.json().catch(() => null)) as { status?: string } | null;
    return { status: json?.status ?? "ok", latency };
  } catch (error) {
    return { status: (error as Error).message ?? "error", latency: null };
  }
};

export const fetchPortalStatus = async (accessToken: string) => {
  const identityUrl = `${resolveIdentityBaseUrl()}/health`;
  const tasksUrl = resolveTasksStatusUrl();

  const [identity, tasks] = await Promise.all([
    fetchWithLatency(identityUrl, { headers: buildHeaders(accessToken), cache: "no-store" }),
    fetchWithLatency(tasksUrl, { cache: "no-store" })
  ]);

  return {
    identity,
    tasks
  } as { identity: ServiceStatus; tasks: ServiceStatus };
};
