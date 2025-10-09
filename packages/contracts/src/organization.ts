import { z } from "zod";

export const OrganizationRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>;

export const InvitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const OrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1).nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type OrganizationResponse = z.infer<typeof OrganizationSchema>;

export const OrganizationUpdateRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).nullable().optional()
});
export type OrganizationUpdateRequest = z.infer<typeof OrganizationUpdateRequestSchema>;

export const OrganizationMemberSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  role: OrganizationRoleSchema,
  userId: z.string().min(1),
  email: z.string().email(),
  fullName: z.string().min(1).optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type OrganizationMemberResponse = z.infer<typeof OrganizationMemberSchema>;

export const OrganizationMembersResponseSchema = z.object({
  members: z.array(OrganizationMemberSchema)
});
export type OrganizationMembersResponse = z.infer<typeof OrganizationMembersResponseSchema>;

export const OrganizationInvitationSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  email: z.string().email(),
  role: OrganizationRoleSchema,
  status: InvitationStatusSchema,
  token: z.string().min(1).optional(),
  tokenHint: z.string().min(1).optional(),
  issuedIp: z.string().min(1).optional().nullable(),
  acceptedIp: z.string().min(1).optional().nullable(),
  acceptedAt: z.string().optional().nullable(),
  invitedById: z.string().min(1),
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type OrganizationInvitationResponse = z.infer<typeof OrganizationInvitationSchema>;

export const OrganizationInvitationsResponseSchema = z.object({
  invitations: z.array(OrganizationInvitationSchema)
});
export type OrganizationInvitationsResponse = z.infer<typeof OrganizationInvitationsResponseSchema>;

export const CreateOrganizationInvitationRequestSchema = z.object({
  email: z.string().email(),
  role: OrganizationRoleSchema,
  expiresInHours: z.number().int().positive().max(720).default(72)
});
export type CreateOrganizationInvitationRequest = z.infer<
  typeof CreateOrganizationInvitationRequestSchema
>;

export const AddOrganizationMemberRequestSchema = z.object({
  email: z.string().email(),
  role: OrganizationRoleSchema,
  fullName: z.string().min(1).optional()
});
export type AddOrganizationMemberRequest = z.infer<typeof AddOrganizationMemberRequestSchema>;

export const UpdateOrganizationMemberRoleRequestSchema = z.object({
  role: OrganizationRoleSchema
});
export type UpdateOrganizationMemberRoleRequest = z.infer<typeof UpdateOrganizationMemberRoleRequestSchema>;
