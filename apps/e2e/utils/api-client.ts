import { AuthFlowResponseSchema, OrganizationInvitationSchema, OrganizationInvitationsResponseSchema, OrganizationMembersResponseSchema, OrganizationSchema } from "@ma/contracts";

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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

export const signupOrganizationOwner = async (input: SignupInput): Promise<SignupResult> => {
  const payload = await jsonRequest(`/auth/signup`, {
    method: "POST",
    body: JSON.stringify({
      organizationName: input.organizationName,
      organizationSlug: input.organizationSlug,
      fullName: input.fullName,
      email: input.email,
      password: input.password
    })
  });

  const parsed = AuthFlowResponseSchema.parse(payload);
  if (parsed.status !== "session") {
    throw new Error("Signup did not return a session response");
  }

  return {
    userId: parsed.session.userId,
    organizationId: parsed.session.organizationId,
    accessToken: parsed.session.accessToken,
    refreshToken: parsed.session.refreshToken,
    expiresIn: parsed.session.expiresIn
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
  input: { email: string; role: string; expiresInHours?: number }
) => {
  const payload = await jsonRequest(`/organization/invitations`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({
      email: input.email,
      role: input.role,
      expiresInHours: input.expiresInHours ?? 72
    })
  });

  return OrganizationInvitationSchema.parse(payload);
};

export const listOrganizationInvitations = async (accessToken: string) => {
  const payload = await jsonRequest(`/organization/invitations`, {
    method: "GET",
    accessToken
  });

  return OrganizationInvitationsResponseSchema.parse(payload);
};
