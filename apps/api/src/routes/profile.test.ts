import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseJwtClaims } from "@ma/core";
import profileRoutes from "./profile";

const signInWithPasswordMock = vi.fn();
const updateUserByIdMock = vi.fn();
const mfaChallengeMock = vi.fn();
const mfaVerifyMock = vi.fn();
const getUserProfileForClaimsMock = vi.fn();

vi.mock("@ma/db", () => ({
  supabaseServiceClient: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      mfa: {
        challenge: (...args: unknown[]) => mfaChallengeMock(...args),
        verify: (...args: unknown[]) => mfaVerifyMock(...args)
      },
      admin: {
        updateUserById: (...args: unknown[]) => updateUserByIdMock(...args)
      }
    }
  },
  getUserProfileForClaims: (...args: unknown[]) => getUserProfileForClaimsMock(...args)
}));

describe("profile password route", () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = Fastify();
    server.decorateRequest("supabaseClaims", null);
    server.addHook("preHandler", (request, _reply, done) => {
      request.supabaseClaims = {
        sub: "user-123",
        email: "user@example.com",
        role: "authenticated"
      } as SupabaseJwtClaims;
      done();
    });
    await server.register(profileRoutes);
    await server.ready();

    signInWithPasswordMock.mockReset();
    updateUserByIdMock.mockReset();
    mfaChallengeMock.mockReset();
    mfaVerifyMock.mockReset();
    getUserProfileForClaimsMock.mockReset();

    getUserProfileForClaimsMock.mockResolvedValue({
      userId: "user-123",
      email: "user@example.com",
      fullName: "Test User"
    });
  });

  afterEach(async () => {
    await server.close();
  });

  it("rejects incorrect current password", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: { session: null },
      error: { status: 400, message: "Invalid login credentials" }
    });

    const response = await server.inject({
      method: "POST",
      url: "/profile/password",
      payload: {
        currentPassword: "bad-password",
        newPassword: "new-password-123"
      }
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error).toMatch(/current password is incorrect/i);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it("requires an MFA code when user has TOTP enabled", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: null,
        mfa: {
          factors: [{ id: "totp-factor", factor_type: "totp" }]
        }
      },
      error: { status: 400, message: "MFA challenge required" }
    });

    const response = await server.inject({
      method: "POST",
      url: "/profile/password",
      payload: {
        currentPassword: "current-password",
        newPassword: "new-password-123"
      }
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.errorCode).toBe("mfa_required");
    expect(body.error).toMatch(/multi-factor authentication code required/i);
    expect(mfaChallengeMock).not.toHaveBeenCalled();
  });

  it("updates password when MFA challenge succeeds", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: null,
        mfa: {
          factors: [{ id: "totp-factor", factor_type: "totp" }]
        }
      },
      error: { status: 400, message: "MFA challenge required" }
    });

    mfaChallengeMock.mockResolvedValue({
      data: { id: "challenge-123" },
      error: null
    });

    mfaVerifyMock.mockResolvedValue({
      data: {},
      error: null
    });

    updateUserByIdMock.mockResolvedValue({ error: null });

    const response = await server.inject({
      method: "POST",
      url: "/profile/password",
      payload: {
        currentPassword: "current-password",
        newPassword: "new-password-123",
        mfaCode: "123456"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.message).toMatch(/password updated/i);
    expect(mfaChallengeMock).toHaveBeenCalledWith({ factorId: "totp-factor" });
    expect(mfaVerifyMock).toHaveBeenCalledWith({
      factorId: "totp-factor",
      challengeId: "challenge-123",
      code: "123456"
    });
    expect(updateUserByIdMock).toHaveBeenCalledWith("user-123", {
      password: "new-password-123"
    });
  });
});
