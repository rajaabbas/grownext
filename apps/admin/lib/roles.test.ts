import { extractAdminRoles, hasRequiredAdminRole } from "./roles";
import type { Session } from "@supabase/supabase-js";

describe("extractAdminRoles", () => {
  it("finds roles from metadata arrays", () => {
    const session = {
      user: {
        app_metadata: { roles: ["super-admin"] },
        user_metadata: {},
        email: "admin@example.com"
      }
    } as unknown as Session;

    const roles = extractAdminRoles(session);
    expect(Array.from(roles)).toContain("super-admin");
  });

  it("detects boolean flag roles", () => {
    const session = {
      user: {
        app_metadata: { super_admin: true },
        user_metadata: {},
        email: "admin@example.com"
      }
    } as unknown as Session;

    const roles = extractAdminRoles(session);
    expect(roles.has("super-admin")).toBe(true);
  });
});

describe("hasRequiredAdminRole", () => {
  it("returns true when any required role is present", () => {
    const session = {
      user: {
        app_metadata: { roles: ["support"] },
        user_metadata: {},
        email: "support@example.com"
      }
    } as unknown as Session;

    const roles = extractAdminRoles(session);
    expect(hasRequiredAdminRole(roles, ["super-admin", "support"])).toBe(true);
  });
});
