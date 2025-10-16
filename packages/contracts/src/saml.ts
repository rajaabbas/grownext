import { z } from "zod";

export const SamlConnectionSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i, "Slug must be alphanumeric with optional hyphens"),
  label: z.string().min(1).max(128),
  idpEntityId: z.string().min(1),
  ssoUrl: z.string().url(),
  sloUrl: z.string().url().nullable(),
  acsUrl: z.string().url(),
  metadataUrl: z.string().url().nullable(),
  metadataXmlPresent: z.boolean(),
  certificates: z.array(z.string().min(1)).min(1),
  defaultRelayState: z.string().nullable(),
  enabled: z.boolean(),
  requireSignedAssertions: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

export type SamlConnection = z.infer<typeof SamlConnectionSchema>;

const slugSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i, "Slug must be alphanumeric with optional hyphens");

const signingCertArraySchema = z.array(z.string().min(1)).min(1, "Provide at least one signing certificate");

export const CreateSamlConnectionRequestSchema = z
  .object({
    slug: slugSchema,
    label: z.string().min(1).max(128),
    metadataXml: z.string().min(1).optional(),
    metadataUrl: z.string().url().optional(),
    idpEntityId: z.string().min(1).optional(),
    ssoUrl: z.string().url().optional(),
    sloUrl: z.string().url().optional().nullable(),
    signingCertificates: signingCertArraySchema.optional(),
    requireSignedAssertions: z.boolean().optional(),
    defaultRelayState: z.string().max(512).optional()
  })
  .superRefine((data, ctx) => {
    const hasMetadata = typeof data.metadataXml === "string" && data.metadataXml.trim().length > 0;
    const hasExplicitConfig =
      !!data.idpEntityId && !!data.ssoUrl && Array.isArray(data.signingCertificates);

    if (!hasMetadata && !hasExplicitConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either metadataXml or explicit IdP configuration",
        path: ["metadataXml"]
      });
    }

    if (hasExplicitConfig && (!data.signingCertificates || data.signingCertificates.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "signingCertificates must include at least one certificate when metadataXml is omitted",
        path: ["signingCertificates"]
      });
    }
  });

export type CreateSamlConnectionRequest = z.infer<typeof CreateSamlConnectionRequestSchema>;

export const UpdateSamlConnectionRequestSchema = z
  .object({
    label: z.string().min(1).max(128).optional(),
    metadataXml: z.string().min(1).optional(),
    metadataUrl: z.string().url().nullable().optional(),
    idpEntityId: z.string().min(1).optional(),
    ssoUrl: z.string().url().optional(),
    sloUrl: z.string().url().nullable().optional(),
    signingCertificates: signingCertArraySchema.optional(),
    requireSignedAssertions: z.boolean().optional(),
    enabled: z.boolean().optional(),
    defaultRelayState: z.string().max(512).nullable().optional()
  })
  .superRefine((data, ctx) => {
    if (data.metadataXml) {
      return;
    }
    if (data.idpEntityId || data.ssoUrl || data.signingCertificates) {
      if (!data.idpEntityId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "idpEntityId is required when updating explicit IdP settings",
          path: ["idpEntityId"]
        });
      }
      if (!data.ssoUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ssoUrl is required when updating explicit IdP settings",
          path: ["ssoUrl"]
        });
      }
      if (!data.signingCertificates || data.signingCertificates.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "signingCertificates must include at least one certificate",
          path: ["signingCertificates"]
        });
      }
    }
  });

export type UpdateSamlConnectionRequest = z.infer<typeof UpdateSamlConnectionRequestSchema>;

export const SamlAuthnRedirectSchema = z.object({
  redirectUrl: z.string().url(),
  requestId: z.string().min(1),
  relayState: z.string().nullable()
});

export type SamlAuthnRedirect = z.infer<typeof SamlAuthnRedirectSchema>;
