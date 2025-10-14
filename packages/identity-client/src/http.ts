import {
  PortalLauncherResponseSchema,
  TasksContextResponseSchema,
  TasksUsersResponseSchema
} from "@ma/contracts";
import type { TasksUsersResponse } from "@ma/contracts";

const resolveIdentityBaseUrl = (): string =>
  process.env.IDENTITY_BASE_URL ??
  process.env.NEXT_PUBLIC_IDENTITY_BASE_URL ??
  "http://localhost:3100";

const buildHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json"
});

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

interface GrantTenantProductInput {
  organizationId: string;
  tenantId: string;
  productId: string;
  userId: string;
  roles: string[];
  expiresAt?: string | null;
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
      userId: input.userId,
      roles: input.roles,
      expiresAt: input.expiresAt ?? undefined
    })
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error ?? `Failed to enable product (${response.status})`);
  }

  return response.json();
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

export interface FetchTasksContextOptions {
  productSlug?: string;
  tenantId?: string;
}

export interface FetchTasksUsersOptions {
  userIds: string[];
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
  const uniqueIds = Array.from(new Set(options.userIds));
  if (uniqueIds.length === 0) {
    return { users: [] };
  }

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
