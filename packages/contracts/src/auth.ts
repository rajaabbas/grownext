import { z } from "zod";
import { InvitationStatusSchema, OrganizationRoleSchema } from "./organization";

export const SignUpRequestSchema = z.object({
  organizationName: z.string().min(1),
  organizationSlug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase and hyphen separated")
    .min(3)
    .max(40)
    .optional(),
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});
export type SignUpRequest = z.infer<typeof SignUpRequestSchema>;

export const AuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("bearer"),
  userId: z.string().min(1),
  organizationId: z.string().min(1)
});
export type AuthSessionResponse = z.infer<typeof AuthSessionSchema>;

export const InvitationDetailsResponseSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  organizationName: z.string().min(1),
  email: z.string().email(),
  role: OrganizationRoleSchema,
  status: InvitationStatusSchema,
  expiresAt: z.string()
});
export type InvitationDetailsResponse = z.infer<typeof InvitationDetailsResponseSchema>;

export const AcceptInvitationRequestSchema = z.object({
  token: z.string().min(1),
  fullName: z.string().min(1),
  password: z.string().min(8)
});
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>;

export const PendingEmailVerificationResponseSchema = z.object({
  status: z.literal("pending_verification"),
  message: z.string().min(1),
  email: z.string().email(),
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  verificationLink: z.string().url().optional()
});
export type PendingEmailVerificationResponse = z.infer<typeof PendingEmailVerificationResponseSchema>;

export const AuthFlowResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("session"),
    session: AuthSessionSchema
  }),
  PendingEmailVerificationResponseSchema
]);
export type AuthFlowResponse = z.infer<typeof AuthFlowResponseSchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().email()
});
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetResponseSchema = z.object({
  status: z.literal("email_sent"),
  message: z.string().min(1),
  verificationLink: z.string().url().optional()
});
export type PasswordResetResponse = z.infer<typeof PasswordResetResponseSchema>;
