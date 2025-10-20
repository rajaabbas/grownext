import {
  fetchSuperAdminUserDetail,
  fetchSuperAdminUsers,
  updateSuperAdminUserStatus as updateSuperAdminUserStatusRequest,
  createSuperAdminImpersonationSession,
  createSuperAdminBulkJob,
  fetchSuperAdminBulkJobs,
  fetchSuperAdminAuditLogs,
  createSuperAdminAuditExport,
  deleteSuperAdminImpersonationSession
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
  SuperAdminAuditExportResponse
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
