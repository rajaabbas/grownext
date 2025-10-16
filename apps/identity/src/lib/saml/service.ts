import { randomUUID } from "node:crypto";
import { IdentityProvider, ServiceProvider, Constants, setSchemaValidator } from "samlify";
import type { SamlConnection } from "@prisma/client";
import { env } from "@ma/core";

// SAMLify requires a schema validator; using a no-op validator keeps dependencies light.
setSchemaValidator({
  validate: () => Promise.resolve("ok")
});

export interface ParsedIdpMetadata {
  entityId: string;
  singleSignOnService: {
    binding: string;
    location: string;
  };
  singleLogoutService?: {
    binding: string;
    location: string;
  };
  signingCertificates: string[];
}

export interface SamlAssertionResult {
  nameId: string;
  sessionIndex?: string | null;
  attributes: Record<string, string | string[]>;
  issuer: string;
  audience?: string | null;
}

const ensureArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

const normalizeString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "value" in first) {
      return String((first as { value: unknown }).value ?? "");
    }
  }
  if (typeof value === "object" && value !== null && "value" in value) {
    return String((value as { value: unknown }).value ?? "");
  }
  return String(value);
};

const normalizeAttributes = (raw: Record<string, unknown> | null | undefined) => {
  const result: Record<string, string | string[]> = {};
  if (!raw) return result;
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      result[key] = value.flatMap((item) => {
        const normalized = normalizeString(item);
        return normalized != null ? [normalized] : [];
      });
      continue;
    }
    const normalized = normalizeString(value);
    if (normalized != null) {
      result[key] = normalized;
    }
  }
  return result;
};

export interface SamlServiceOptions {
  entityId?: string;
  signingPrivateKey?: string;
  signingCertificate?: string;
  nameIdFormats?: string[];
}

export class SamlService {
  private readonly entityId: string;
  private readonly signingKey: string;
  private readonly signingCert: string;
  private readonly nameIdFormats: string[];

  constructor(options?: SamlServiceOptions) {
    this.entityId = options?.entityId ?? env.IDENTITY_SAML_SP_ENTITY_ID;
    this.signingKey =
      options?.signingPrivateKey ?? env.IDENTITY_SAML_SP_SIGNING_PRIVATE_KEY ?? "";
    this.signingCert =
      options?.signingCertificate ?? env.IDENTITY_SAML_SP_SIGNING_CERT ?? "";
    this.nameIdFormats =
      options?.nameIdFormats ?? [env.IDENTITY_SAML_NAMEID_FORMAT ?? Constants.namespace.format.emailAddress];

    if (!this.signingKey || !this.signingCert) {
      throw new Error("SAML signing key and certificate must be configured");
    }
  }

  parseIdentityProviderMetadata(metadataXml: string): ParsedIdpMetadata {
    const idp = IdentityProvider({ metadata: metadataXml });
    const entityId = idp.entityMeta.getEntityID();
    const redirectSso = idp.entityMeta.getSingleSignOnService("redirect");
    const postSso = idp.entityMeta.getSingleSignOnService("post");
    const singleSignOnService = redirectSso ?? postSso;

    if (!entityId || !singleSignOnService) {
      throw new Error("Unable to resolve required IdP metadata fields");
    }

    const redirectSlo = idp.entityMeta.getSingleLogoutService("redirect");
    const postSlo = idp.entityMeta.getSingleLogoutService("post");
    const singleLogoutService = redirectSlo ?? postSlo ?? undefined;

    const signingCertificates = ensureArray(idp.entityMeta.getX509Certificate("signing")).filter(
      (cert): cert is string => typeof cert === "string" && cert.length > 0
    );

    if (signingCertificates.length === 0) {
      throw new Error("IdP metadata missing signing certificate");
    }

    return {
      entityId,
      singleSignOnService: {
        binding: redirectSso ? "redirect" : "post",
        location: singleSignOnService as string
      },
      singleLogoutService: singleLogoutService
        ? {
            binding: redirectSlo ? "redirect" : "post",
            location: singleLogoutService as string
          }
        : undefined,
      signingCertificates
    };
  }

  buildServiceProvider(connection: SamlConnection): ServiceProvider {
    return ServiceProvider({
      entityID: this.entityId,
      privateKey: this.signingKey,
      signingCert: this.signingCert,
      authnRequestsSigned: true,
      wantAssertionsSigned: connection.requireSignedAssertions,
      nameIDFormat: this.nameIdFormats,
      assertionConsumerService: [
        {
          Binding: Constants.namespace.binding.post,
          Location: connection.acsUrl
        }
      ],
      singleLogoutService: connection.sloUrl
        ? [
            {
              Binding: Constants.namespace.binding.redirect,
              Location: connection.sloUrl
            }
          ]
        : undefined
    });
  }

  buildIdentityProvider(connection: SamlConnection): IdentityProvider {
    if (connection.metadataXml) {
      return IdentityProvider({
        metadata: connection.metadataXml
      });
    }

    return IdentityProvider({
      entityID: connection.idpEntityId,
      signingCert: connection.certificates,
      wantAuthnRequestsSigned: true,
      singleSignOnService: [
        {
          Binding: Constants.namespace.binding.redirect,
          Location: connection.ssoUrl
        }
      ],
      singleLogoutService: connection.sloUrl
        ? [
            {
              Binding: Constants.namespace.binding.redirect,
              Location: connection.sloUrl
            }
          ]
        : undefined
    });
  }

  generateServiceProviderMetadata(connection: SamlConnection): string {
    const sp = this.buildServiceProvider(connection);
    return sp.getMetadata();
  }

  createAuthnRequest(connection: SamlConnection, relayState?: string) {
    const sp = this.buildServiceProvider(connection);
    const idp = this.buildIdentityProvider(connection);

    // `createLoginRequest` may throw if metadata mismatched.
    const result = sp.createLoginRequest(idp, "redirect");

    const requestId = result.id ?? `_${randomUUID()}`;
    const redirectUrl = typeof result.context === "string" ? result.context : "";

    return {
      requestId,
      redirectUrl,
      relayState: relayState ?? null
    };
  }

  async validatePostAssertion(
    connection: SamlConnection,
    encodedSamlResponse: string,
    relayState?: string | null
  ): Promise<SamlAssertionResult> {
    const sp = this.buildServiceProvider(connection);
    const idp = this.buildIdentityProvider(connection);

    const flowResult = await sp.parseLoginResponse(idp, "post", {
      body: {
        SAMLResponse: encodedSamlResponse,
        ...(relayState ? { RelayState: relayState } : {})
      }
    });

    const { extract } = flowResult;
    const issuer = normalizeString(extract.issuer) ?? idp.entityMeta.getEntityID() ?? "";
    const nameId = normalizeString(extract.nameID);

    if (!nameId) {
      throw new Error("SAML response missing NameID");
    }

    const sessionIndex = normalizeString(extract.sessionIndex?.sessionIndex);
    const audience = normalizeString(extract.audience);
    const attributes = normalizeAttributes(extract.attributes);

    return {
      nameId,
      sessionIndex,
      attributes,
      issuer,
      audience
    };
  }
}
