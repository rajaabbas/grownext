import { describe, expect, it } from "vitest";
import {
  HealthResponseSchema,
  InvitationDetailsResponseSchema,
  OrganizationInvitationSchema,
  SignUpRequestSchema,
  PendingEmailVerificationResponseSchema,
  PasswordResetRequestSchema,
  PasswordResetResponseSchema,
  AuthFlowResponseSchema,
  VersionResponseSchema,
  WhoAmIResponseSchema,
  SuperAdminImpersonationRequestSchema,
  SuperAdminImpersonationResponseSchema,
  SuperAdminBulkJobCreateRequestSchema,
  SuperAdminBulkJobsResponseSchema,
  SuperAdminAuditLogResponseSchema
} from "./index";

describe("contracts", () => {
  it("validates health response", () => {
    const result = HealthResponseSchema.safeParse({
      status: "ok",
      time: new Date().toISOString(),
      uptime: 123
    });

    expect(result.success).toBe(true);
  });

  it("validates version response", () => {
    const result = VersionResponseSchema.safeParse({ version: "0.0.1" });
    expect(result.success).toBe(true);
  });

  it("validates whoami response", () => {
    const result = WhoAmIResponseSchema.safeParse({
      userId: "user-123",
      organizationId: "org-123",
      email: "user@example.com",
      fullName: "Test User",
      role: "OWNER"
    });
    expect(result.success).toBe(true);
  });

  it("validates signup request", () => {
    const result = SignUpRequestSchema.safeParse({
      organizationName: "Acme Inc",
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "examplepass"
    });
    expect(result.success).toBe(true);
  });

  it("validates invitation details response", () => {
    const result = InvitationDetailsResponseSchema.safeParse({
      id: "inv-1",
      organizationId: "org-123",
      organizationName: "Acme Inc",
      email: "invitee@example.com",
      role: "MEMBER",
      status: "PENDING",
      expiresAt: new Date().toISOString()
    });
    expect(result.success).toBe(true);
  });

  it("validates organization invitation with optional hashed fields", () => {
    const result = OrganizationInvitationSchema.safeParse({
      id: "inv-1",
      organizationId: "org-123",
      email: "invitee@example.com",
      role: "MEMBER",
      status: "PENDING",
      tokenHint: "abc123",
      invitedById: "user-123",
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    expect(result.success).toBe(true);
  });

  it("validates pending email verification flow", () => {
    const result = PendingEmailVerificationResponseSchema.safeParse({
      status: "pending_verification",
      message: "Check your inbox",
      email: "owner@example.com",
      userId: "user-123",
      organizationId: "org-123",
      verificationLink: "https://example.com/auth/confirm?token=abc"
    });

    expect(result.success).toBe(true);
  });

  it("validates password reset schemas", () => {
    expect(PasswordResetRequestSchema.safeParse({ email: "user@example.com" }).success).toBe(true);

    expect(
      PasswordResetResponseSchema.safeParse({
        status: "email_sent",
        message: "Link sent",
        verificationLink: "https://example.com/auth/reset"
      }).success
    ).toBe(true);
  });

  it("validates auth flow union", () => {
    const sessionResult = AuthFlowResponseSchema.safeParse({
      status: "session",
      session: {
        accessToken: "access",
        refreshToken: "refresh",
        expiresIn: 3600,
        tokenType: "bearer",
        userId: "user-123",
        organizationId: "org-123"
      }
    });

    expect(sessionResult.success).toBe(true);

    const pendingResult = AuthFlowResponseSchema.safeParse({
      status: "pending_verification",
      message: "Verify your email",
      email: "user@example.com",
      userId: "user-123",
      organizationId: "org-123"
    });

    expect(pendingResult.success).toBe(true);
  });

  it("validates super admin impersonation contracts", () => {
    expect(
      SuperAdminImpersonationRequestSchema.safeParse({
        reason: "Investigating support ticket",
        expiresInMinutes: 15,
        productSlug: "portal"
      }).success
    ).toBe(true);

    const now = new Date().toISOString();
    expect(
      SuperAdminImpersonationResponseSchema.safeParse({
        tokenId: "token-123",
        url: "https://admin.grownext.dev/impersonate?token=token-123",
        expiresAt: now,
        createdAt: now
      }).success
    ).toBe(true);
  });

  it("validates super admin bulk job contracts", () => {
    expect(
      SuperAdminBulkJobCreateRequestSchema.safeParse({
        action: "SUSPEND_USERS",
        userIds: ["user-1", "user-2"],
        reason: "Security sweep"
      }).success
    ).toBe(true);

    const now = new Date().toISOString();
    expect(
      SuperAdminBulkJobsResponseSchema.safeParse({
        jobs: [
          {
            id: "job-1",
            action: "SUSPEND_USERS",
            status: "RUNNING",
            totalCount: 2,
            completedCount: 1,
            failedCount: 0,
            createdAt: now,
            updatedAt: now,
            initiatedBy: {
              id: "admin-1",
              email: "admin@example.com"
            },
            errorMessage: null
          }
        ]
      }).success
    ).toBe(true);
  });

  it("validates super admin audit log response", () => {
    const now = new Date().toISOString();
    expect(
      SuperAdminAuditLogResponseSchema.safeParse({
        events: [
          {
            id: "event-1",
            eventType: "USER_SUSPENDED",
            description: "Suspended via bulk job",
            organizationId: "org-1",
            tenantId: null,
            productId: null,
            metadata: { reason: "Security sweep" },
            createdAt: now
          }
        ],
        pagination: {
          page: 1,
          pageSize: 25,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false
        }
      }).success
    ).toBe(true);
  });
});
