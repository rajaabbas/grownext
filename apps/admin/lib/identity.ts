import {
  fetchSuperAdminUserDetail,
  fetchSuperAdminUsers,
  updateSuperAdminUserStatus as updateSuperAdminUserStatusRequest,
  createSuperAdminImpersonationSession,
  createSuperAdminBulkJob,
  fetchSuperAdminBulkJobs,
  fetchSuperAdminAuditLogs,
  createSuperAdminAuditExport,
  deleteSuperAdminImpersonationSession,
  fetchAdminBillingCatalog,
  createAdminBillingPackage,
  updateAdminBillingPackage,
  fetchAdminBillingSubscriptions,
  fetchAdminBillingInvoices,
  updateAdminBillingInvoiceStatus,
  fetchAdminBillingUsage,
  issueAdminBillingCredit,
  fetchAdminBillingCredits
} from "@ma/identity-client";
import type {
  SuperAdminUserDetail,
  SuperAdminUserListQuery,
  SuperAdminUserStatusUpdateRequest,
  SuperAdminUsersResponse,
  SuperAdminImpersonationRequest,
  SuperAdminImpersonationResponse,
  SuperAdminBulkJobCreateRequest,
  SuperAdminBulkJobsResponse,
  SuperAdminBulkJob,
  SuperAdminAuditLogQuery,
  SuperAdminAuditLogResponse,
  SuperAdminAuditExportResponse,
  AdminBillingCatalogResponse,
  AdminBillingSubscriptionListResponse,
  AdminBillingInvoiceListResponse,
  AdminBillingInvoiceStatusUpdateRequest,
  AdminBillingUsageResponse,
  AdminBillingUsageQuery,
  AdminBillingCreditListResponse,
  AdminBillingCreditIssueRequest,
  BillingPackage,
  BillingInvoice,
  BillingCreditMemo
} from "@ma/contracts";

export const getSuperAdminUsers = async (
  accessToken: string,
  query?: Partial<SuperAdminUserListQuery>
): Promise<SuperAdminUsersResponse> => {
  return fetchSuperAdminUsers(accessToken, query);
};

export const getSuperAdminUserDetail = async (
  accessToken: string,
  userId: string,
  verifiedEmail?: string
): Promise<SuperAdminUserDetail> => {
  return fetchSuperAdminUserDetail(accessToken, userId, verifiedEmail);
};

export const updateSuperAdminUserStatus = async (
  accessToken: string,
  userId: string,
  input: SuperAdminUserStatusUpdateRequest
): Promise<SuperAdminUserDetail> => {
  return updateSuperAdminUserStatusRequest(accessToken, userId, input);
};

export const createImpersonationSession = async (
  accessToken: string,
  userId: string,
  input: SuperAdminImpersonationRequest
): Promise<SuperAdminImpersonationResponse> => {
  return createSuperAdminImpersonationSession(accessToken, userId, input);
};

export const stopImpersonationSession = async (
  accessToken: string,
  userId: string,
  tokenId: string
): Promise<void> => {
  await deleteSuperAdminImpersonationSession(accessToken, userId, tokenId);
};

export const createBulkJob = async (
  accessToken: string,
  input: SuperAdminBulkJobCreateRequest
): Promise<SuperAdminBulkJob> => {
  return createSuperAdminBulkJob(accessToken, input);
};

export const listBulkJobs = async (accessToken: string): Promise<SuperAdminBulkJobsResponse> => {
  return fetchSuperAdminBulkJobs(accessToken);
};

export const getAuditLogs = async (
  accessToken: string,
  query?: Partial<SuperAdminAuditLogQuery>
): Promise<SuperAdminAuditLogResponse> => {
  return fetchSuperAdminAuditLogs(accessToken, query);
};

export const createAuditExport = async (
  accessToken: string,
  query?: Partial<SuperAdminAuditLogQuery>
): Promise<SuperAdminAuditExportResponse> => {
  return createSuperAdminAuditExport(accessToken, query);
};

export const getAdminBillingCatalog = async (
  accessToken: string
): Promise<AdminBillingCatalogResponse> => {
  return fetchAdminBillingCatalog(accessToken);
};

export const createBillingPackage = async (
  accessToken: string,
  input: Parameters<typeof createAdminBillingPackage>[1]
): Promise<BillingPackage> => {
  return createAdminBillingPackage(accessToken, input);
};

export const updateBillingPackage = async (
  accessToken: string,
  packageId: string,
  input: Parameters<typeof updateAdminBillingPackage>[2]
): Promise<BillingPackage> => {
  return updateAdminBillingPackage(accessToken, packageId, input);
};

export const getAdminBillingSubscriptions = async (
  accessToken: string,
  params?: { organizationId?: string; status?: string }
): Promise<AdminBillingSubscriptionListResponse> => {
  return fetchAdminBillingSubscriptions(accessToken, params);
};

export const getAdminBillingInvoices = async (
  accessToken: string,
  params?: { organizationId?: string; status?: string }
): Promise<AdminBillingInvoiceListResponse> => {
  return fetchAdminBillingInvoices(accessToken, params);
};

export const updateBillingInvoiceStatus = async (
  accessToken: string,
  invoiceId: string,
  input: AdminBillingInvoiceStatusUpdateRequest
): Promise<BillingInvoice> => {
  return updateAdminBillingInvoiceStatus(accessToken, invoiceId, input);
};

export const getAdminBillingUsage = async (
  accessToken: string,
  query?: Partial<AdminBillingUsageQuery>
): Promise<AdminBillingUsageResponse> => {
  return fetchAdminBillingUsage(accessToken, query);
};

export const issueBillingCredit = async (
  accessToken: string,
  organizationId: string,
  input: AdminBillingCreditIssueRequest
): Promise<BillingCreditMemo> => {
  return issueAdminBillingCredit(accessToken, organizationId, input);
};

export const getAdminBillingCredits = async (
  accessToken: string,
  organizationId?: string
): Promise<AdminBillingCreditListResponse> => {
  return fetchAdminBillingCredits(accessToken, organizationId);
};
