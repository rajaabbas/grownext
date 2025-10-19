import {
  OrganizationInvitationSchema,
  OrganizationInvitationsResponseSchema,
  OrganizationMembersResponseSchema,
  OrganizationSchema,
  TasksContextResponseSchema
} from "@ma/contracts";
import { createClient } from "@supabase/supabase-js";
import {
  hasSupabaseAdmin,
  createSupabaseUser,
  updateSupabaseUserContext
} from "./supabase-admin";

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const TASKS_PRODUCT_SLUG = process.env.E2E_TASKS_PRODUCT_SLUG ?? "tasks";

interface SignupInput {
  organizationName: string;
  organizationSlug?: string;
  fullName: string;
  email: string;
  password: string;
}

interface SignupResult {
  userId: string;
  organizationId: string;
  tenantId: string;
  accessToken: string;
}

const jsonRequest = async <T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<T> => {
  const { accessToken, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);
  headers.set("Content-Type", "application/json");
  headers.set("x-testsuite-ip", "playwright");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const errorMessage = payload?.error ?? `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload as T;
};

const resolveSupabaseCredentials = () => {
  if (!hasSupabaseAdmin) {
    throw new Error("Supabase service role credentials are required for E2E signup");
  }

  const supabaseUrl =
    process.env.E2E_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.E2E_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase anon credentials are required for E2E signup");
  }
  return { supabaseUrl, supabaseAnonKey };
};

const createSupabaseSessionClient = () => {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseCredentials();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  });
};

export const signupOrganizationOwner = async (input: SignupInput): Promise<SignupResult> => {
  const supabaseClient = createSupabaseSessionClient();

  const user = await createSupabaseUser({
    email: input.email,
    password: input.password,
    userMetadata: {
      full_name: input.fullName,
      organization_name: input.organizationName
    }
  });

  const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: input.email,
    password: input.password
  });

  if (signInError || !signInData.session) {
    throw new Error(signInError?.message ?? "Failed to obtain Supabase session");
  }

  const accessToken = signInData.session.access_token;

  const organizationPayload = await jsonRequest(`/admin/organizations`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({
      name: input.organizationName,
      defaultTenantName: `${input.organizationName} Workspace`
    })
  });

  const organizationResult = organizationPayload as {
    organization: { id: string };
    defaultTenant: { id: string };
  };

  if (!organizationResult.organization || !organizationResult.defaultTenant) {
    throw new Error("Organization onboarding response was missing required data");
  }

  await updateSupabaseUserContext({
    userId: user.id,
    userMetadata: {
      ...(user.user_metadata ?? {}),
      organization_id: organizationResult.organization.id,
      tenant_id: organizationResult.defaultTenant.id
    },
    appMetadata: {
      ...(user.app_metadata ?? {}),
      organization_id: organizationResult.organization.id,
      tenant_id: organizationResult.defaultTenant.id
    }
  });

  return {
    userId: user.id,
    organizationId: organizationResult.organization.id,
    tenantId: organizationResult.defaultTenant.id,
    accessToken
  };
};

export const fetchOrganization = async (accessToken: string) => {
  const payload = await jsonRequest(`/organization`, {
    method: "GET",
    accessToken
  });

  return OrganizationSchema.parse(payload);
};

export const listOrganizationMembers = async (accessToken: string) => {
  const payload = await jsonRequest(`/organization/members`, {
    method: "GET",
    accessToken
  });

  return OrganizationMembersResponseSchema.parse(payload);
};

export const createOrganizationInvitation = async (
  accessToken: string,
  input: { organizationId: string; email: string; role: string; expiresInHours?: number }
) => {
  const payload = await jsonRequest<{ invitation: unknown; token: string }>(
    `/admin/organizations/${input.organizationId}/invitations`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        email: input.email,
        role: input.role,
        expiresInHours: input.expiresInHours ?? 72
      })
    }
  );

  const parsed = OrganizationInvitationSchema.parse(payload.invitation);
  return {
    ...parsed,
    token: payload.token
  };
};

export const listOrganizationInvitations = async (accessToken: string, organizationId: string) => {
  const payload = await jsonRequest(
    `/admin/organizations/${organizationId}/invitations`,
    {
      method: "GET",
      accessToken
    }
  );

  return OrganizationInvitationsResponseSchema.parse(payload);
};

interface OrganizationDetailResponse {
  organizationId: string;
  tenants: Array<{
    id: string;
    name: string;
    slug: string | null;
  }>;
  members: unknown[];
}

export const fetchOrganizationDetail = async (accessToken: string, organizationId: string) => {
  const payload = await jsonRequest<OrganizationDetailResponse>(`/admin/organizations/${organizationId}`, {
    method: "GET",
    accessToken
  });

  return payload;
};

interface OrganizationProductsResponse {
  products: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  entitlements: Array<{
    id: string;
    organizationId: string;
    tenantId: string;
    productId: string;
    userId: string;
    roles: string[];
    expiresAt: string | null;
  }>;
}

export const fetchOrganizationProducts = async (accessToken: string, organizationId: string) => {
  const payload = await jsonRequest<OrganizationProductsResponse>(`/admin/organizations/${organizationId}/products`, {
    method: "GET",
    accessToken
  });

  return payload;
};

export const fetchTasksTenancyContext = async (
  accessToken: string,
  input: { tenantId?: string } = {}
) => {
  const params = new URLSearchParams({
    productSlug: TASKS_PRODUCT_SLUG
  });

  if (input.tenantId) {
    params.set("tenantId", input.tenantId);
  }

  const payload = await jsonRequest(`/internal/tasks/context?${params.toString()}`, {
    method: "GET",
    accessToken
  });

  return TasksContextResponseSchema.parse(payload);
};

export const ensureTasksProductEntitlement = async (accessToken: string, input: { organizationId: string; tenantId: string; userId: string }) => {
  const { products, entitlements } = await fetchOrganizationProducts(accessToken, input.organizationId);
  const tasksProduct = products.find((product) => product.slug === TASKS_PRODUCT_SLUG);

  if (!tasksProduct) {
    throw new Error(`Tasks product (${TASKS_PRODUCT_SLUG}) not registered for organization ${input.organizationId}`);
  }

  const alreadyGranted = entitlements.some(
    (entitlement) =>
      entitlement.productId === tasksProduct.id &&
      entitlement.tenantId === input.tenantId &&
      entitlement.userId === input.userId
  );

  if (alreadyGranted) {
    return;
  }

  await jsonRequest(`/admin/tenants/${input.tenantId}/entitlements`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({
      organizationId: input.organizationId,
      productId: tasksProduct.id,
      userId: input.userId
    })
  });
};

export const enableTenantApp = async (
  accessToken: string,
  tenantId: string,
  productId: string
) => {
  await jsonRequest(`/admin/tenants/${tenantId}/apps`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({ productId })
  });
};

export const refreshAccessToken = async (email: string, password: string): Promise<string> => {
  const supabaseClient = createSupabaseSessionClient();
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    throw new Error(error?.message ?? "Failed to refresh access token");
  }

  return data.session.access_token;
};
