import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const { buildServiceRoleClaimsMock, withAuthorizationTransactionMock } = vi.hoisted(() => ({
  buildServiceRoleClaimsMock: vi.fn(),
  withAuthorizationTransactionMock: vi.fn()
}));

vi.mock("@ma/core", () => ({
  buildServiceRoleClaims: buildServiceRoleClaimsMock
}));

let currentTx: {
  organization: { delete: Mock };
  organizationMember: { deleteMany: Mock };
  userProfile: { delete: Mock };
};

vi.mock("./prisma", () => ({
  withAuthorizationTransaction: withAuthorizationTransactionMock
}));

// Import after mocks so the module under test uses the mocked dependencies.
import {
  deleteOrganizationCascade,
  removeUserFromOrganizationRecords
} from "./user-management";

let organizationDelete: Mock;
let organizationMemberDeleteMany: Mock;
let userProfileDelete: Mock;

beforeEach(() => {
  buildServiceRoleClaimsMock.mockReset();
  withAuthorizationTransactionMock.mockReset();

  organizationDelete = vi.fn().mockResolvedValue(undefined);
  organizationMemberDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
  userProfileDelete = vi.fn().mockResolvedValue(undefined);

  currentTx = {
    organization: { delete: organizationDelete },
    organizationMember: { deleteMany: organizationMemberDeleteMany },
    userProfile: { delete: userProfileDelete }
  };

  withAuthorizationTransactionMock.mockImplementation(async (_claims, callback) => {
    return callback(currentTx);
  });

  buildServiceRoleClaimsMock.mockImplementation((organizationId?: string) => ({
    organizationId
  }));
});

describe("deleteOrganizationCascade", () => {
  it("deletes the organization within the authorization transaction", async () => {
    await deleteOrganizationCascade("org-123");

    expect(buildServiceRoleClaimsMock).toHaveBeenCalledWith("org-123");
    expect(withAuthorizationTransactionMock).toHaveBeenCalledTimes(1);
    expect(withAuthorizationTransactionMock.mock.calls[0][0]).toEqual({ organizationId: "org-123" });
    expect(organizationDelete).toHaveBeenCalledWith({ where: { id: "org-123" } });
  });
});

describe("removeUserFromOrganizationRecords", () => {
  it("removes membership records but preserves the user profile by default", async () => {
    await removeUserFromOrganizationRecords("org-456", "user-789");

    expect(buildServiceRoleClaimsMock).toHaveBeenCalledWith("org-456");
    expect(organizationMemberDeleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org-456", userId: "user-789" }
    });
    expect(userProfileDelete).not.toHaveBeenCalled();
  });

  it("deletes the user profile when explicitly requested", async () => {
    await removeUserFromOrganizationRecords("org-456", "user-789", { deleteProfile: true });

    expect(organizationMemberDeleteMany).toHaveBeenCalledWith({
      where: { organizationId: "org-456", userId: "user-789" }
    });
    expect(userProfileDelete).toHaveBeenCalledWith({ where: { userId: "user-789" } });
  });
});
