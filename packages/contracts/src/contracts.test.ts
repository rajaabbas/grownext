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
  PortalLauncherResponseSchema,
  TasksContextResponseSchema,
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

  it("validates portal launcher response with enhanced fields", () => {
    const now = new Date().toISOString();
    const result = PortalLauncherResponseSchema.safeParse({
      user: {
        id: "user-123",
        email: "user@example.com",
        fullName: "Portal User",
        organizationId: "org-123",
        organizationName: "GrowNext",
        organizationRole: "OWNER",
        tenantMemberships: [
          {
            tenantId: "tenant-1",
            role: "ADMIN"
          }
        ],
        entitlements: [
          {
            productId: "prod-1",
            productSlug: "tasks",
            productName: "Tasks",
            tenantId: "tenant-1",
            tenantName: "Core",
            roles: ["ADMIN"]
          }
        ]
      },
      tenants: [
        {
          id: "tenant-1",
          name: "Core",
          slug: "core",
          description: null,
          membersCount: 5,
          productsCount: 2
        }
      ],
      rolePermissions: [
        {
          role: "OWNER",
          permissions: ["organization:view", "permissions:view"],
          source: "default"
        }
      ],
      products: [
        {
          productId: "prod-1",
          productSlug: "tasks",
          name: "Tasks",
          description: "Productivity suite",
          iconUrl: "https://example.com/icon.png",
          launchUrl: "https://tasks.example.com",
          roles: ["ADMIN"],
          lastUsedAt: now
        }
      ],
      sessions: [
        {
          id: "session-1",
          createdAt: now,
          ipAddress: "127.0.0.1",
          userAgent: "Chrome",
          description: null,
          productId: "prod-1",
          tenantId: "tenant-1",
          revokedAt: null
        }
      ],
      tenantMembersCount: 12,
      adminActions: [
        {
          id: "action-1",
          eventType: "ADMIN_ACTION",
          description: "User suspended for policy violation",
          createdAt: now,
          actor: {
            id: "admin-1",
            email: "admin@example.com",
            name: "Admin User"
          },
          tenant: {
            id: "tenant-1",
            name: "Core"
          },
          metadata: {
            reason: "policy_violation"
          }
        }
      ],
      notifications: [
        {
          id: "notification-1",
          type: "bulk-job",
          title: "Bulk export ready",
          description: "Download the export before it expires.",
          createdAt: now,
          actionUrl: "https://example.com/export.csv",
          meta: {
            jobId: "job-1"
          }
        }
      ],
      impersonation: {
        tokenId: "token-1",
        startedAt: now,
        expiresAt: now,
        reason: "Support case",
        productSlug: "portal",
        initiatedBy: {
          id: "admin-1",
          email: "admin@example.com",
          name: "Admin User"
        }
      },
      supportLinks: [
        {
          label: "Tenant Support Runbook",
          href: "/docs/operations/runbooks/identity",
          description: "Review escalation steps and safeguards.",
          external: false
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("validates tasks context response with notifications", () => {
    const now = new Date().toISOString();
    const result = TasksContextResponseSchema.safeParse({
      user: {
        id: "user-123",
        email: "user@example.com",
        fullName: "Tasks User",
        status: "SUSPENDED"
      },
      organization: {
        id: "org-1",
        name: "GrowNext",
        slug: "grownext"
      },
      product: {
        id: "prod-1",
        slug: "tasks",
        name: "Tasks"
      },
      entitlements: [],
      tenants: [],
      activeTenant: {
        entitlementId: "ent-1",
        tenantId: "tenant-1",
        tenantName: "Core",
        roles: ["ADMIN"],
        source: "metadata"
      },
      projects: [],
      projectSummaries: [],
      permissions: {
        roles: ["ADMIN"],
        effective: {
          canView: true,
          canCreate: false,
          canEdit: false,
          canComment: false,
          canAssign: false,
          canManage: false
        }
      },
      notifications: [
        {
          id: "notif-1",
          type: "bulk-job",
          title: "Bulk suspension completed",
          description: "4 users processed.",
          createdAt: now,
          actionUrl: null,
          meta: { jobId: "job-1" }
        }
      ]
    });

    expect(result.success).toBe(true);
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
