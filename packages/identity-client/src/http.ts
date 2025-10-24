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
  BillingInvoiceLineTypeValues,
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

export class IdentityHttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfter?: number;
  readonly body?: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      retryAfter?: number;
      body?: unknown;
    }
  ) {
    super(message);
    this.name = "IdentityHttpError";
    this.status = options.status;
    this.code = options.code;
    this.retryAfter = options.retryAfter;
    this.body = options.body;
  }
}

const parseRetryAfterHeader = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }

  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) {
    const seconds = Math.max(0, Math.round((asDate - Date.now()) / 1000));
    return seconds;
  }

  return undefined;
};

const readErrorPayload = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
};

const resolveErrorDetails = (
  payload: unknown,
  fallbackMessage: string
): { message: string; code?: string } => {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const messageCandidate =
      typeof record.message === "string" && record.message.trim().length > 0
        ? record.message.trim()
        : undefined;
    const errorCandidate =
      typeof record.error === "string" && record.error.trim().length > 0
        ? record.error.trim()
        : undefined;
    const codeCandidate =
      typeof record.code === "string" && record.code.trim().length > 0
        ? record.code.trim()
        : errorCandidate;

    return {
      message: messageCandidate ?? errorCandidate ?? fallbackMessage,
      code: codeCandidate
    };
  }

  return {
    message: fallbackMessage,
    code: undefined
  };
};

const createIdentityHttpError = async (
  response: Response,
  fallbackMessage: string
): Promise<IdentityHttpError> => {
  const payload = await readErrorPayload(response);
  const { message, code } = resolveErrorDetails(payload, fallbackMessage);
  return new IdentityHttpError(message, {
    status: response.status,
    code,
    retryAfter: parseRetryAfterHeader(response.headers.get("retry-after")),
    body: payload ?? undefined
  });
};

const ensureIdentityResponse = async (
  response: Response,
  fallbackMessage: string
): Promise<void> => {
  if (response.ok) {
    return;
  }

  throw await createIdentityHttpError(response, fallbackMessage);
};

const parseJsonResponse = async <T>(
  response: Response,
  fallbackMessage: string
): Promise<T> => {
  await ensureIdentityResponse(response, fallbackMessage);
  return (await response.json()) as T;
};

const parseWithSchema = async <T>(
  response: Response,
  fallbackMessage: string,
  schema: z.ZodType<T>
): Promise<T> => {
  await ensureIdentityResponse(response, fallbackMessage);
  const json = await response.json();
  return schema.parse(json);
};

const resolveIdentityBaseUrl = (): string =>
  process.env.IDENTITY_BASE_URL ??
  process.env.NEXT_PUBLIC_IDENTITY_BASE_URL ??
  "http://localhost:3100";

export interface IdentityRequestContext {
  organizationId?: string;
  tenantId?: string;
}

const buildHeaders = (accessToken: string, context?: IdentityRequestContext) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };

  if (context?.organizationId) {
    headers["X-Organization-Id"] = context.organizationId;
  }

  if (context?.tenantId) {
    headers["X-Tenant-Id"] = context.tenantId;
  }

  return headers;
};

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

    await ensureIdentityResponse(response, "Failed to emit billing usage events");
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

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

  await ensureIdentityResponse(response, "Failed to aggregate billing usage");
  const json = await response.json();
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

  return parseWithSchema(
    response,
    "Failed to process billing invoice",
    BillingInvoiceJobResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to synchronize billing payment",
    BillingPaymentSyncResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to fetch super admin users",
    SuperAdminUsersResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to fetch user detail",
    SuperAdminUserDetailSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to update organization role",
    SuperAdminUserDetailSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to update tenant role",
    SuperAdminUserDetailSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to grant entitlement",
    SuperAdminUserDetailSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to revoke entitlement",
    SuperAdminUserDetailSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to update user status",
    SuperAdminUserDetailSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to create impersonation session",
    SuperAdminImpersonationResponseSchema
  );
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

  if (response.status === 404) {
    return;
  }

  await ensureIdentityResponse(response, "Failed to stop impersonation session");
};

export const cleanupSuperAdminImpersonationSessions = async (
  accessToken: string
): Promise<SuperAdminImpersonationCleanupResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/impersonation/cleanup`, {
    method: "POST",
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to cleanup impersonation sessions",
    SuperAdminImpersonationCleanupResponseSchema
  );
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

  return parseWithSchema(response, "Failed to create bulk job", SuperAdminBulkJobSchema);
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

  return parseWithSchema(response, "Failed to update bulk job", SuperAdminBulkJobSchema);
};

export const fetchSuperAdminBulkJobs = async (
  accessToken: string
): Promise<SuperAdminBulkJobsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/bulk-jobs`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to fetch bulk jobs",
    SuperAdminBulkJobsResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to fetch audit logs",
    SuperAdminAuditLogResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to create audit export",
    SuperAdminAuditExportResponseSchema
  );
};

export const fetchPortalLauncher = async (accessToken: string) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/launcher`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to fetch launcher data",
    PortalLauncherResponseSchema
  );
};

export const fetchPortalPermissions = async (accessToken: string) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/permissions`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to fetch portal permissions",
    PortalPermissionsResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to update portal permissions",
    PortalRolePermissionsSchema
  );
};

export const fetchPortalBillingOverview = async (
  accessToken: string,
  context?: IdentityRequestContext
): Promise<PortalBillingOverviewResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/overview`, {
    headers: buildHeaders(accessToken, context),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to fetch billing overview",
    PortalBillingOverviewResponseSchema
  );
};

type PortalBillingUsageParams =
  | Partial<BillingUsageQuery>
  | {
      query?: Partial<BillingUsageQuery>;
      context?: IdentityRequestContext;
    };

export const fetchPortalBillingUsage = async (
  accessToken: string,
  params?: PortalBillingUsageParams
): Promise<PortalBillingUsageResponse> => {
  const query = params && "context" in params ? params.query : params;
  const context = params && "context" in params ? params.context : undefined;
  const parsedQuery = query ? BillingUsageQuerySchema.parse(query) : {};
  const searchParams = new URLSearchParams();
  if (parsedQuery.featureKey) searchParams.set("featureKey", parsedQuery.featureKey);
  if (parsedQuery.from) searchParams.set("from", parsedQuery.from);
  if (parsedQuery.to) searchParams.set("to", parsedQuery.to);
  if (parsedQuery.resolution) searchParams.set("resolution", parsedQuery.resolution);
  if (parsedQuery.tenantId) searchParams.set("tenantId", parsedQuery.tenantId);
  if (parsedQuery.productId) searchParams.set("productId", parsedQuery.productId);

  const url =
    searchParams.size > 0
      ? `${resolveIdentityBaseUrl()}/portal/billing/usage?${searchParams.toString()}`
      : `${resolveIdentityBaseUrl()}/portal/billing/usage`;

  const response = await fetch(url, {
    headers: buildHeaders(accessToken, context),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to fetch billing usage",
    PortalBillingUsageResponseSchema
  );
};

export const changePortalBillingSubscription = async (
  accessToken: string,
  input: PortalBillingSubscriptionChangeRequest,
  context?: IdentityRequestContext
): Promise<PortalBillingSubscriptionChangeResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/subscription/change`, {
    method: "POST",
    headers: buildHeaders(accessToken, context),
    cache: "no-store",
    body: JSON.stringify(PortalBillingSubscriptionChangeRequestSchema.parse(input))
  });

  return parseWithSchema(
    response,
    "Failed to change subscription",
    PortalBillingSubscriptionChangeResponseSchema
  );
};

export const cancelPortalBillingSubscription = async (
  accessToken: string,
  input?: PortalBillingSubscriptionCancelRequest,
  context?: IdentityRequestContext
): Promise<PortalBillingSubscriptionChangeResponse> => {
  const payload = PortalBillingSubscriptionCancelRequestSchema.parse(
    input ?? { cancelAtPeriodEnd: true }
  );

  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/subscription/cancel`, {
    method: "POST",
    headers: buildHeaders(accessToken, context),
    cache: "no-store",
    body: JSON.stringify(payload)
  });

  return parseWithSchema(
    response,
    "Failed to cancel subscription",
    PortalBillingSubscriptionChangeResponseSchema
  );
};

export const fetchPortalBillingInvoices = async (
  accessToken: string,
  context?: IdentityRequestContext
): Promise<PortalBillingInvoiceListResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/invoices`, {
    headers: buildHeaders(accessToken, context),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to fetch invoices",
    PortalBillingInvoiceListResponseSchema
  );
};

export const fetchPortalBillingContacts = async (
  accessToken: string,
  context?: IdentityRequestContext
): Promise<PortalBillingContactsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/contacts`, {
    headers: buildHeaders(accessToken, context),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to fetch billing contacts",
    PortalBillingContactsResponseSchema
  );
};

export const updatePortalBillingContacts = async (
  accessToken: string,
  input: PortalBillingContactsUpdateRequest,
  context?: IdentityRequestContext
): Promise<PortalBillingContactsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/contacts`, {
    method: "PATCH",
    headers: buildHeaders(accessToken, context),
    cache: "no-store",
    body: JSON.stringify(PortalBillingContactsUpdateRequestSchema.parse(input))
  });

  return parseWithSchema(
    response,
    "Failed to update billing contacts",
    PortalBillingContactsResponseSchema
  );
};

export const fetchPortalBillingPaymentMethods = async (
  accessToken: string,
  context?: IdentityRequestContext
): Promise<PortalBillingPaymentMethodsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/payment-methods`, {
    headers: buildHeaders(accessToken, context),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to fetch payment methods",
    PortalBillingPaymentMethodsResponseSchema
  );
};

export const upsertPortalBillingPaymentMethod = async (
  accessToken: string,
  input: PortalBillingPaymentMethodUpsertRequest,
  context?: IdentityRequestContext
): Promise<PortalBillingPaymentMethodsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/payment-methods`, {
    method: "POST",
    headers: buildHeaders(accessToken, context),
    cache: "no-store",
    body: JSON.stringify(PortalBillingPaymentMethodUpsertRequestSchema.parse(input))
  });

  return parseWithSchema(
    response,
    "Failed to save payment method",
    PortalBillingPaymentMethodsResponseSchema
  );
};

export const setPortalDefaultBillingPaymentMethod = async (
  accessToken: string,
  input: PortalBillingSetDefaultPaymentMethodRequest,
  context?: IdentityRequestContext
): Promise<PortalBillingPaymentMethodsResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/billing/payment-methods/default`, {
    method: "PATCH",
    headers: buildHeaders(accessToken, context),
    cache: "no-store",
    body: JSON.stringify(PortalBillingSetDefaultPaymentMethodRequestSchema.parse(input))
  });

  return parseWithSchema(
    response,
    "Failed to set default payment method",
    PortalBillingPaymentMethodsResponseSchema
  );
};

export const deletePortalBillingPaymentMethod = async (
  accessToken: string,
  paymentMethodId: string,
  context?: IdentityRequestContext
): Promise<PortalBillingPaymentMethodsResponse> => {
  const response = await fetch(
    `${resolveIdentityBaseUrl()}/portal/billing/payment-methods/${encodeURIComponent(paymentMethodId)}`,
    {
      method: "DELETE",
      headers: buildHeaders(accessToken, context),
      cache: "no-store"
    }
  );

  if (response.status === 204) {
    return fetchPortalBillingPaymentMethods(accessToken, context);
  }

  return parseWithSchema(
    response,
    "Failed to remove payment method",
    PortalBillingPaymentMethodsResponseSchema
  );
};

export const revokeIdentitySession = async (accessToken: string, sessionId: string) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/portal/sessions/${sessionId}`, {
    method: "DELETE",
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  if (response.status === 204) {
    return;
  }

  await ensureIdentityResponse(response, "Failed to revoke session");
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

  return parseJsonResponse(response, "Failed to create tenant");
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

  return parseJsonResponse(response, "Failed to create organization");
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

  return parseJsonResponse(response, "Failed to create invitation");
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

  return parseJsonResponse(response, "Failed to update organization");
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

  if (response.status === 204) {
    return;
  }

  await ensureIdentityResponse(response, "Failed to delete invitation");
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

  return parseJsonResponse(response, "Failed to update tenant");
};

export const deleteTenant = async (accessToken: string, tenantId: string): Promise<void> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/tenants/${tenantId}`, {
    method: "DELETE",
    headers: buildHeaders(accessToken)
  });

  if (response.status === 204) {
    return;
  }

  await ensureIdentityResponse(response, "Failed to delete tenant");
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

  return parseJsonResponse(response, "Failed to enable product");
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

  return parseJsonResponse(response, "Failed to enable app");
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

  if (response.status === 204) {
    return;
  }

  await ensureIdentityResponse(response, "Failed to disable app");
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

  return parseJsonResponse<OrganizationProductResponse>(
    response,
    "Failed to load products"
  );
};

export const fetchAdminBillingCatalog = async (
  accessToken: string
): Promise<AdminBillingCatalogResponse> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/billing/packages`, {
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  return parseWithSchema(
    response,
    "Failed to fetch billing catalog",
    AdminBillingCatalogResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to create billing package",
    BillingPackageSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to update billing package",
    BillingPackageSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to fetch billing subscriptions",
    AdminBillingSubscriptionListResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to fetch billing invoices",
    AdminBillingInvoiceListResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to update invoice",
    BillingInvoiceSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to fetch billing usage",
    AdminBillingUsageResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to issue credit",
    BillingCreditMemoSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to fetch credits",
    AdminBillingCreditListResponseSchema
  );
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

  return parseJsonResponse<InvitationPreviewResponse>(
    response,
    "Failed to preview invitation"
  );
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

  return parseJsonResponse<InvitationAcceptanceResponse>(
    response,
    "Failed to accept invitation"
  );
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

  return parseJsonResponse<OrganizationDetailResponse>(
    response,
    "Failed to load organization"
  );
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

  await ensureIdentityResponse(response, "Failed to remove member");
};

export const deleteOrganization = async (accessToken: string, organizationId: string) => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/admin/organizations/${organizationId}`, {
    method: "DELETE",
    headers: buildHeaders(accessToken),
    cache: "no-store"
  });

  await ensureIdentityResponse(response, "Failed to delete organization");
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

  return parseJsonResponse<TenantDetailResponse>(response, "Failed to load tenant");
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

  await ensureIdentityResponse(response, "Failed to add tenant member");
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

  await ensureIdentityResponse(response, "Failed to update tenant member");
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

  if (response.status === 204) {
    return;
  }

  await ensureIdentityResponse(response, "Failed to remove tenant member");
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

  if (response.status === 204) {
    return;
  }

  await ensureIdentityResponse(response, "Failed to revoke tenant entitlement");
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

  return parseWithSchema(
    response,
    "Failed to fetch tasks context",
    TasksContextResponseSchema
  );
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

  return parseWithSchema(
    response,
    "Failed to fetch tasks users",
    TasksUsersResponseSchema
  );
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
