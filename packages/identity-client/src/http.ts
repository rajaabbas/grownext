import {
  PortalLauncherResponseSchema,
  PortalPermissionsResponseSchema,
  PortalRolePermissionsSchema,
  SuperAdminUsersResponseSchema,
  SuperAdminUserDetailSchema,
  SuperAdminOrganizationRoleUpdateRequestSchema,
  SuperAdminTenantRoleUpdateRequestSchema,
  SuperAdminEntitlementGrantRequestSchema,
  SuperAdminEntitlementRevokeRequestSchema,
  SuperAdminUserStatusUpdateRequestSchema,
  SuperAdminImpersonationRequestSchema,
  SuperAdminImpersonationResponseSchema,
  SuperAdminBulkJobCreateRequestSchema,
  SuperAdminBulkJobSchema,
  SuperAdminBulkJobsResponseSchema,
  SuperAdminAuditLogResponseSchema,
  SuperAdminAuditLogQuerySchema,
  SuperAdminAuditExportResponseSchema,
  TasksContextResponseSchema,
  TasksUsersResponseSchema,
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
  SuperAdminBulkJob,
  SuperAdminBulkJobsResponse,
  SuperAdminAuditLogResponse,
  SuperAdminAuditLogQuery,
  SuperAdminAuditExportResponse,
  TasksUsersResponse,
  SuperAdminUsersResponse,
  SuperAdminUserDetail
} from "@ma/contracts";

const resolveIdentityBaseUrl = (): string =>
  process.env.IDENTITY_BASE_URL ??
  process.env.NEXT_PUBLIC_IDENTITY_BASE_URL ??
  "http://localhost:3100";

const buildHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json"
});

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
  userId: string
): Promise<SuperAdminUserDetail> => {
  const response = await fetch(`${resolveIdentityBaseUrl()}/super-admin/users/${encodeURIComponent(userId)}`, {
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
