import type { Prisma, SamlAccount, SamlConnection } from "@prisma/client";
import type { SupabaseJwtClaims } from "@ma/core";
import { withAuthorizationTransaction } from "./prisma";

const normalizeNullable = <T>(value: T | null | undefined): T | null =>
  value === undefined ? null : value;

export interface CreateSamlConnectionInput {
  organizationId: string;
  slug: string;
  label: string;
  idpEntityId: string;
  ssoUrl: string;
  sloUrl?: string | null;
  certificates: string[];
  metadataXml?: string | null;
  metadataUrl?: string | null;
  acsUrl: string;
  defaultRelayState?: string | null;
  enabled?: boolean;
  requireSignedAssertions?: boolean;
}

export const createSamlConnection = async (
  claims: SupabaseJwtClaims | null,
  input: CreateSamlConnectionInput
): Promise<SamlConnection> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.samlConnection.create({
      data: {
        organizationId: input.organizationId,
        slug: input.slug,
        label: input.label,
        idpEntityId: input.idpEntityId,
        ssoUrl: input.ssoUrl,
        sloUrl: normalizeNullable(input.sloUrl),
        certificates: input.certificates,
        metadataXml: normalizeNullable(input.metadataXml),
        metadataUrl: normalizeNullable(input.metadataUrl),
        acsUrl: input.acsUrl,
        defaultRelayState: normalizeNullable(input.defaultRelayState),
        enabled: input.enabled ?? true,
        requireSignedAssertions: input.requireSignedAssertions ?? true
      }
    })
  );
};

export interface UpdateSamlConnectionInput {
  samlConnectionId: string;
  label?: string;
  idpEntityId?: string;
  ssoUrl?: string;
  sloUrl?: string | null;
  certificates?: string[];
  metadataXml?: string | null;
  metadataUrl?: string | null;
  acsUrl?: string;
  defaultRelayState?: string | null;
  enabled?: boolean;
  requireSignedAssertions?: boolean;
}

export const updateSamlConnection = async (
  claims: SupabaseJwtClaims | null,
  input: UpdateSamlConnectionInput
): Promise<SamlConnection> => {
  const data: Prisma.SamlConnectionUpdateInput = {};

  if (input.label !== undefined) data.label = input.label;
  if (input.idpEntityId !== undefined) data.idpEntityId = input.idpEntityId;
  if (input.ssoUrl !== undefined) data.ssoUrl = input.ssoUrl;
  if (input.sloUrl !== undefined) data.sloUrl = normalizeNullable(input.sloUrl);
  if (input.certificates !== undefined) data.certificates = input.certificates;
  if (input.metadataXml !== undefined) data.metadataXml = normalizeNullable(input.metadataXml);
  if (input.metadataUrl !== undefined) data.metadataUrl = normalizeNullable(input.metadataUrl);
  if (input.acsUrl !== undefined) data.acsUrl = input.acsUrl;
  if (input.defaultRelayState !== undefined)
    data.defaultRelayState = normalizeNullable(input.defaultRelayState);
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.requireSignedAssertions !== undefined)
    data.requireSignedAssertions = input.requireSignedAssertions;

  return withAuthorizationTransaction(claims, (tx) =>
    tx.samlConnection.update({
      where: { id: input.samlConnectionId },
      data
    })
  );
};

export const deleteSamlConnection = async (
  claims: SupabaseJwtClaims | null,
  samlConnectionId: string
): Promise<void> => {
  await withAuthorizationTransaction(claims, (tx) =>
    tx.samlConnection.delete({
      where: { id: samlConnectionId }
    })
  );
};

export const listSamlConnectionsForOrganization = async (
  claims: SupabaseJwtClaims | null,
  organizationId: string
): Promise<SamlConnection[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.samlConnection.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" }
    })
  );
};

export const getSamlConnectionById = async (
  claims: SupabaseJwtClaims | null,
  samlConnectionId: string
): Promise<SamlConnection | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.samlConnection.findUnique({
      where: { id: samlConnectionId }
    })
  );
};

export const getSamlConnectionBySlug = async (
  claims: SupabaseJwtClaims | null,
  slug: string
): Promise<SamlConnection | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.samlConnection.findUnique({
      where: { slug }
    })
  );
};

export interface LinkSamlAccountInput {
  samlConnectionId: string;
  userId: string;
  nameId: string;
  email: string;
  attributes?: Record<string, unknown> | null;
}

export const linkSamlAccount = async (
  claims: SupabaseJwtClaims | null,
  input: LinkSamlAccountInput
): Promise<SamlAccount> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.samlAccount.upsert({
      where: {
        samlConnectionId_nameId: {
          samlConnectionId: input.samlConnectionId,
          nameId: input.nameId
        }
      },
      update: {
        userId: input.userId,
        email: input.email,
        attributes: (input.attributes ?? Prisma.JsonNull) as Prisma.InputJsonValue
      },
      create: {
        samlConnectionId: input.samlConnectionId,
        userId: input.userId,
        nameId: input.nameId,
        email: input.email,
        attributes: (input.attributes ?? Prisma.JsonNull) as Prisma.InputJsonValue
      }
    })
  );
};

export const findSamlAccount = async (
  claims: SupabaseJwtClaims | null,
  samlConnectionId: string,
  nameId: string
): Promise<SamlAccount | null> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.samlAccount.findUnique({
      where: {
        samlConnectionId_nameId: {
          samlConnectionId,
          nameId
        }
      }
    })
  );
};

export const listSamlAccountsForUser = async (
  claims: SupabaseJwtClaims | null,
  userId: string
): Promise<SamlAccount[]> => {
  return withAuthorizationTransaction(claims, (tx) =>
    tx.samlAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" }
    })
  );
};
